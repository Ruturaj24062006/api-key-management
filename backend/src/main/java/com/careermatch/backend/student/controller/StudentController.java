package com.careermatch.backend.student.controller;

import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.common.ApiResponse;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.student.dto.StudentProfileDto;
import com.careermatch.backend.student.service.StudentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/students")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Student Profile Management", description = "Endpoints for retrieving and updating student profiles and onboarding info")
public class StudentController {

    private final StudentService studentService;
    private final UserRepository userRepository;

    @GetMapping("/profile")
    @PreAuthorize("hasAuthority('ROLE_STUDENT')")
    @Operation(summary = "Get current student profile and onboarding details")
    public ResponseEntity<ApiResponse<StudentProfileDto>> getProfile() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Logged-in user not found"));

        StudentProfileDto profile = studentService.getProfile(user.getId());
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasAuthority('ROLE_STUDENT')")
    @Operation(summary = "Save and update student profile and onboarding details")
    public ResponseEntity<ApiResponse<StudentProfileDto>> updateProfile(@RequestBody StudentProfileDto dto) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Logged-in user not found"));

        StudentProfileDto updated = studentService.updateProfile(user.getId(), dto);
        return ResponseEntity.ok(ApiResponse.success("Profile updated successfully", updated));
    }
}
