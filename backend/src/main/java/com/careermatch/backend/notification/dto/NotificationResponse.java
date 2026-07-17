package com.careermatch.backend.notification.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class NotificationResponse {
    private UUID id;
    private String title;
    private String message;
    private String type;
    private String status;
    private LocalDateTime createdAt;
}
