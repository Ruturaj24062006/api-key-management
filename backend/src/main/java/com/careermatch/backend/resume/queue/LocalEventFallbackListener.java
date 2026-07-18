package com.careermatch.backend.resume.queue;

import com.careermatch.backend.common.event.JobMatchingRequestedEvent;
import com.careermatch.backend.common.event.ResumeUploadedEvent;
import com.careermatch.backend.matching.service.MatchingService;
import com.careermatch.backend.resume.service.ResumeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class LocalEventFallbackListener {

    private final ResumeService resumeService;
    private final MatchingService matchingService;

    /**
     * Fallback: processes resume AI pipeline locally when RabbitMQ is down.
     */
    @EventListener
    @Async
    public void onResumeUploadedFallback(ResumeUploadedEvent event) {
        log.warn("LOCAL FALLBACK: Processing ResumeUploadedEvent for resume {} (RabbitMQ was unavailable).",
                event.getResumeId());
        resumeService.processResume(event.getResumeId());
    }

    /**
     * Fallback: triggers job matching locally when RabbitMQ is down.
     */
    @EventListener
    @Async
    public void onJobMatchingRequestedFallback(JobMatchingRequestedEvent event) {
        log.warn("LOCAL FALLBACK: Running JobMatchingRequestedEvent matching for student {} (RabbitMQ was unavailable).",
                event.getStudentId());
        try {
            matchingService.generateMatchesForStudent(event.getStudentId());
        } catch (Exception e) {
            log.error("Local fallback matching pipeline failed for student {}: {}", event.getStudentId(), e.getMessage(), e);
        }
    }
}
