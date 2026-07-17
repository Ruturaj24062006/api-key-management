package com.careermatch.backend.notification.controller;

import com.careermatch.backend.common.ApiResponse;
import com.careermatch.backend.notification.dto.NotificationResponse;
import com.careermatch.backend.notification.entity.Notification;
import com.careermatch.backend.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notification System", description = "Endpoints for checking and managing alerts/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "Get list of notifications for the current logged-in user")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getMyNotifications() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        List<Notification> notifications = notificationService.getUserNotifications(email);
        List<NotificationResponse> response = notifications.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<ApiResponse<String>> markAsRead(@PathVariable("id") UUID id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        notificationService.markAsRead(id, email);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read", "Success"));
    }

    @PutMapping("/read-all")
    @Operation(summary = "Mark all notifications as read")
    public ResponseEntity<ApiResponse<String>> markAllAsRead() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        notificationService.markAllAsRead(email);
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", "Success"));
    }

    private NotificationResponse mapToResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .message(n.getMessage())
                .type(n.getType().name())
                .status(n.getStatus().name())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
