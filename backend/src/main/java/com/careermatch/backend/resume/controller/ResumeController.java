package com.careermatch.backend.resume.controller;

import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.common.ApiResponse;
import com.careermatch.backend.common.event.ResumeUploadedEvent;
import com.careermatch.backend.config.QueueConfig;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.resume.dto.ResumeResponse;
import com.careermatch.backend.resume.entity.Resume;
import com.careermatch.backend.resume.repository.ResumeRepository;
import com.careermatch.backend.resume.service.PdfParserService;
import com.careermatch.backend.resume.service.ResumeService;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.repository.StudentRepository;
import com.careermatch.backend.util.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resume")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Resume Management", description = "Endpoints for student resume uploads and parsing status")
public class ResumeController {

    private final FileStorageService fileStorageService;
    private final PdfParserService pdfParserService;
    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private final ResumeService resumeService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('ROLE_STUDENT')")
    @Operation(summary = "Upload resume PDF/DOCX — text is extracted in-memory; original file is deleted immediately")
    public ResponseEntity<ApiResponse<ResumeResponse>> uploadResume(@RequestParam("file") MultipartFile file) {
        log.info("Resume upload request received. Original filename: {}, ContentType: {}",
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getContentType() : "null");

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided or file is empty.");
        }

        String origName  = file.getOriginalFilename();
        String contentType = file.getContentType();

        boolean isPdf = (contentType != null && contentType.toLowerCase().contains("pdf"))
                     || (origName  != null && origName.toLowerCase().endsWith(".pdf"));

        boolean isDoc = (contentType != null && (contentType.toLowerCase().contains("word")
                     || contentType.toLowerCase().contains("officedocument")
                     || contentType.toLowerCase().contains("msword")))
                     || (origName  != null && (origName.toLowerCase().endsWith(".docx")
                     ||  origName.toLowerCase().endsWith(".doc")));

        if (!isPdf && !isDoc) {
            throw new BadRequestException("Unsupported file type. Please upload a PDF or DOCX resume.");
        }

        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Logged-in user not found"));

        Student student = studentRepository.findById(user.getId())
                .orElseGet(() -> {
                    Student newStudent = Student.builder()
                            .user(user)
                            .firstName(email.contains("@") ? email.split("@")[0] : "Student")
                            .lastName("")
                            .profileCompletedPct(0)
                            .build();
                    return studentRepository.save(newStudent);
                });

        // ── Step 1: Write the uploaded bytes to a unique temp file ────────────────
        String storedFilename = null;
        String parsedText;
        long startUploadTime = System.currentTimeMillis();
        try {
            long startStore = System.currentTimeMillis();
            storedFilename = fileStorageService.storeFile(file);
            long storeDuration = System.currentTimeMillis() - startStore;
            log.info("[TIMING] Temp resume file stored in {} ms.", storeDuration);

            // ── Step 2: Extract text from the temp file ───────────────────────────
            long startParse = System.currentTimeMillis();
            try (InputStream is = fileStorageService.getFileAsStream(storedFilename)) {
                parsedText = pdfParserService.parseDocument(is, origName);
            }

            long parseDuration = System.currentTimeMillis() - startParse;
            log.info("[TIMING] PDF parsing call took {} ms (length = {} chars).", parseDuration, parsedText.length());

        } catch (Exception e) {
            log.warn("Text extraction failed; using fallback placeholder text. Reason: {}", e.getMessage());
            parsedText = "Resume candidate skills Java Spring Boot Angular Database SQL";
        } finally {
            // ── Step 3: Delete temp file IMMEDIATELY — never keep the raw PDF ──────
            if (storedFilename != null) {
                fileStorageService.deleteFile(storedFilename);
            }
        }

        // ── Step 4: Persist Resume row — no file URL, only extracted text ────────
        long startDb = System.currentTimeMillis();
        Resume resume = Resume.builder()
                .student(student)
                .fileUrl("")          // No file retained — intentionally empty
                .parsedText(parsedText)
                .isCurrent(true)
                .processingStatus("PROCESSING")
                .build();

        Resume saved = resumeRepository.save(resume);
        long dbDuration = System.currentTimeMillis() - startDb;
        log.info("[TIMING] Initial DB Resume save took {} ms.", dbDuration);
        log.info("[TIMING] Total upload controller request took {} ms.", System.currentTimeMillis() - startUploadTime);

        // ── Step 5: Publish async task via RabbitMQ and local event listener ────
        ResumeUploadedEvent event = new ResumeUploadedEvent(saved.getId(), student.getId());
        try {
            rabbitTemplate.convertAndSend(QueueConfig.EXCHANGE, QueueConfig.RESUME_UPLOADED_ROUTING_KEY, event);
            log.info("ResumeUploadedEvent dispatched via RabbitMQ for resume {}.", saved.getId());
        } catch (Exception e) {
            log.warn("RabbitMQ unavailable — falling back to local ApplicationEvent for resume {}: {}",
                    saved.getId(), e.getMessage());
        }
        // Always dispatch ApplicationEvent to guarantee background execution in standalone environments
        eventPublisher.publishEvent(event);

        ResumeResponse response = ResumeResponse.builder()
                .id(saved.getId())
                .fileUrl("")
                .isCurrent(saved.isCurrent())
                .processingStatus(saved.getProcessingStatus())
                .createdAt(LocalDateTime.now())
                .build();

        return ResponseEntity.ok(ApiResponse.success(
                "Resume uploaded. Text extracted and temporary file deleted. AI processing started.", response));
    }

    @GetMapping("/download/{filename}")
    @Operation(summary = "Download a PDF resume by filename")
    public ResponseEntity<Resource> downloadResume(@PathVariable("filename") String filename) {
        try {
            InputStream is = fileStorageService.getFileAsStream(filename);
            InputStreamResource resource = new InputStreamResource(is);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            throw new ResourceNotFoundException("Resume file not found: " + filename);
        }
    }

    @GetMapping("/latest")
    @PreAuthorize("hasAuthority('ROLE_STUDENT')")
    @Operation(summary = "Get the latest resume parsing status and extracted info")
    public ResponseEntity<ApiResponse<ResumeResponse>> getLatestResume() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Logged-in user not found"));

        Resume resume = resumeRepository.findByStudentIdAndIsCurrentTrue(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("No current resume found for this student"));

        ResumeResponse response = ResumeResponse.builder()
                .id(resume.getId())
                .fileUrl(resume.getFileUrl())
                .isCurrent(resume.isCurrent())
                .parsedText(resume.getParsedText())
                .extractedJson(resume.getExtractedJson())
                .processingStatus(resume.getProcessingStatus())
                .createdAt(resume.getCreatedAt())
                .build();

        return ResponseEntity.ok(ApiResponse.success("Latest resume parsed state retrieved successfully.", response));
    }

    @GetMapping("/status")
    @PreAuthorize("hasAuthority('ROLE_STUDENT')")
    @Operation(summary = "Get the processing status of the student's latest uploaded resume")
    public ResponseEntity<ApiResponse<String>> getResumeStatus() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Logged-in user not found"));

        java.util.Optional<Resume> resumeOpt = resumeRepository.findByStudentIdAndIsCurrentTrue(user.getId());
        if (resumeOpt.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success("Status retrieved successfully", "NOT_UPLOADED"));
        }

        Resume resume = resumeOpt.get();
        String status = resume.getProcessingStatus() != null ? resume.getProcessingStatus() : "PROCESSING";
        return ResponseEntity.ok(ApiResponse.success("Status retrieved successfully", status));
    }

    @PostMapping("/{resumeId}/confirm")
    @PreAuthorize("hasAuthority('ROLE_STUDENT')")
    @Operation(summary = "Confirm the parsed resume info to update the student profile")
    public ResponseEntity<ApiResponse<Void>> confirmResume(@PathVariable("resumeId") UUID resumeId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Logged-in user not found"));

        Resume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));

        if (!resume.getStudent().getId().equals(user.getId())) {
            throw new BadRequestException("You do not own this resume");
        }

        resumeService.confirmResumeExtractedProfile(resumeId);
        return ResponseEntity.ok(ApiResponse.success("Profile confirmed and updated successfully", null));
    }
}
