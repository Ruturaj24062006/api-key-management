package com.careermatch.backend.resume.queue;

import com.careermatch.backend.common.event.ResumeUploadedEvent;
import com.careermatch.backend.config.QueueConfig;
import com.careermatch.backend.resume.service.ResumeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Consumes ResumeUploadedEvent from RabbitMQ and triggers the AI processing
 * pipeline.
 *
 * NOTE: @EventListener has been intentionally removed. The local Spring
 * ApplicationEvent
 * fallback is handled by {@link LocalEventFallbackListener} to avoid
 * double-processing
 * when both RabbitMQ and the local event fire.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ResumeTaskListener {

    private final ResumeService resumeService;

    @RabbitListener(queues = QueueConfig.RESUME_UPLOADED_QUEUE)
    public void handleResumeUploaded(ResumeUploadedEvent event) {
        log.info("RabbitMQ: Received ResumeUploadedEvent for resume ID: {}", event.getResumeId());
        try {
            resumeService.processResume(event.getResumeId());
        } catch (Exception e) {
            log.error("Failed to process resume {} via RabbitMQ: {}", event.getResumeId(), e.getMessage(), e);
            // Re-throw to trigger RabbitMQ retry policy and route to DLQ after max attempts
            throw e;
        }
    }
}
