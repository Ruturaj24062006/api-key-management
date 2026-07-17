package com.careermatch.backend.application.service;

import com.careermatch.backend.application.dto.ApplyRequest;
import com.careermatch.backend.application.dto.UpdateStatusRequest;
import com.careermatch.backend.application.entity.Application;
import com.careermatch.backend.application.entity.ApplicationStatus;
import com.careermatch.backend.application.repository.ApplicationRepository;
import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.notification.entity.Notification;
import com.careermatch.backend.notification.entity.NotificationStatus;
import com.careermatch.backend.notification.entity.NotificationType;
import com.careermatch.backend.notification.repository.NotificationRepository;
import com.careermatch.backend.resume.entity.Resume;
import com.careermatch.backend.resume.repository.ResumeRepository;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final StudentRepository studentRepository;
    private final JobRepository jobRepository;
    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    @Transactional
    public Application applyToJob(UUID jobId, ApplyRequest request, String studentEmail) {
        User user = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new BadRequestException("Student user not found"));

        Student student = studentRepository.findById(user.getId())
                .orElseThrow(() -> new BadRequestException("Student profile not initialized"));

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        Resume resume = resumeRepository.findByStudentIdAndIsCurrentTrue(student.getId())
                .orElseThrow(() -> new BadRequestException("Please upload a resume first before applying"));

        if (applicationRepository.findByStudentIdAndJobId(student.getId(), jobId).isPresent()) {
            throw new BadRequestException("You have already applied for this job");
        }

        Application application = Application.builder()
                .student(student)
                .job(job)
                .resume(resume)
                .coverLetter(request.getCoverLetter())
                .status(ApplicationStatus.APPLIED)
                .build();

        Application saved = applicationRepository.save(application);
        log.info("Student {} applied to Job: {}", student.getId(), jobId);

        // Notify Recruiter (New application / New candidate)
        createNotification(job.getRecruiter().getUser(), "New Application", 
                "A new candidate " + student.getFirstName() + " " + student.getLastName() + 
                " has applied for your job post: " + job.getTitle());

        // Notify Student (Application submitted)
        createNotification(student.getUser(), "Application Submitted", 
                "You have successfully submitted your application for " + job.getTitle() + 
                " at " + job.getCompany().getName());

        return saved;
    }

    @Transactional
    public Application updateApplicationStatus(UUID applicationId, UpdateStatusRequest request) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + applicationId));

        application.setStatus(request.getStatus());
        application.setFeedback(request.getFeedback());
        Application saved = applicationRepository.save(application);

        log.info("Application {} status updated to {}", applicationId, request.getStatus());

        // Notify Student based on new status
        String title = "Application Status Changed";
        String msg = "Your application for the position of " + application.getJob().getTitle() + 
                " has been updated to: " + request.getStatus();

        switch (request.getStatus()) {
            case SHORTLISTED:
                title = "Shortlisted for " + application.getJob().getTitle();
                msg = "Congratulations! You have been Shortlisted for " + application.getJob().getTitle() + 
                        " at " + application.getJob().getCompany().getName() + ".";
                break;
            case INTERVIEW:
                title = "Interview Scheduled";
                msg = "Interview scheduled! The recruiter has invited you for an interview for " + 
                        application.getJob().getTitle() + ". Please review feedback for details.";
                break;
            case ACCEPTED:
            case OFFER:
                title = "Selected Candidate Alert";
                msg = "Congratulations! You have been Selected for the position of " + 
                        application.getJob().getTitle() + " at " + application.getJob().getCompany().getName() + "!";
                break;
            case REJECTED:
                title = "Application Update";
                msg = "Thank you for your interest in " + application.getJob().getTitle() + 
                        ". Unfortunately, we will not be moving forward with your application at this time.";
                break;
            default:
                break;
        }

        if (request.getFeedback() != null && !request.getFeedback().isBlank()) {
            msg += " Feedback: " + request.getFeedback();
        }

        createNotification(application.getStudent().getUser(), title, msg);

        return saved;
    }

    @Transactional
    public Application respondToInterview(UUID applicationId, String response, String note, String studentEmail) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + applicationId));

        if (!app.getStudent().getUser().getEmail().equals(studentEmail)) {
            throw new BadRequestException("You do not own this application.");
        }

        String statusNote = "Student responded: " + response;
        if (note != null && !note.isBlank()) {
            statusNote += " - " + note;
        }
        app.setFeedback(statusNote);
        Application saved = applicationRepository.save(app);

        // Notify Recruiter (Interview response)
        String msg = "Student " + app.getStudent().getFirstName() + " " + app.getStudent().getLastName() +
                " has " + response.toLowerCase() + " your interview request for: " + app.getJob().getTitle();
        if (note != null && !note.isBlank()) {
            msg += ". Message: " + note;
        }
        createNotification(app.getJob().getRecruiter().getUser(), "Interview Response Received", msg);

        return saved;
    }

    public List<Application> getApplicationsForStudent(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User not found"));
        return applicationRepository.findByStudentId(user.getId());
    }

    public List<Application> getApplicationsForJob(UUID jobId) {
        return applicationRepository.findByJobId(jobId);
    }

    private void createNotification(User user, String title, String message) {
        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(NotificationType.IN_APP)
                .status(NotificationStatus.PENDING)
                .build();
        notificationRepository.save(notification);
        log.info("Notification created for user: {} - Title: {}", user.getEmail(), title);
    }
}
