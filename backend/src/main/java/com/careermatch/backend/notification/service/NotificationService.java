package com.careermatch.backend.notification.service;

import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.notification.entity.Notification;
import com.careermatch.backend.notification.entity.NotificationStatus;
import com.careermatch.backend.notification.entity.NotificationType;
import com.careermatch.backend.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public List<Notification> getUserNotifications(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User not found: " + email));
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    @Transactional
    public void createNotification(User user, String title, String message, NotificationType type) {
        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(type)
                .status(NotificationStatus.PENDING) // Default state
                .build();
        notificationRepository.save(notification);
        log.info("Saved notification for user {}: {}", user.getEmail(), title);
    }

    @Transactional
    public Notification markAsRead(UUID notificationId, String userEmail) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));

        if (!notification.getUser().getEmail().equals(userEmail)) {
            throw new BadRequestException("You do not own this notification.");
        }

        notification.setStatus(NotificationStatus.READ);
        return notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BadRequestException("User not found: " + userEmail));
        List<Notification> unread = notificationRepository.findByUserIdAndStatusOrderByCreatedAtDesc(
                user.getId(), NotificationStatus.PENDING);
        for (Notification notification : unread) {
            notification.setStatus(NotificationStatus.READ);
        }
        notificationRepository.saveAll(unread);
    }
}
