import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService, NotificationDto } from '../../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  imports: [NgIf, NgFor, DatePipe, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit {
  notifications = signal<NotificationDto[]>([]);
  isOpen = signal<boolean>(false);

  unreadCount = computed(() => {
    return this.notifications().filter(n => n.status === 'PENDING').length;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.isOpen.set(false);
  }

  constructor(
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.isLoggedIn()) {
      this.loadNotifications();
      // Poll notifications every 30 seconds
      setInterval(() => {
        if (this.isLoggedIn()) {
          this.loadNotifications();
        }
      }, 30000);
    }
  }

  loadNotifications(): void {
    this.notificationService.getMyNotifications().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.notifications.set(res.data);
        }
      },
      error: (err) => console.error('Failed to load navbar notifications:', err)
    });
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(open => !open);
    if (this.isOpen() && this.unreadCount() > 0) {
      // Auto-read all when opened for simplicity
      this.markAllAsRead();
    }
  }

  markAsRead(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.markAsRead(id).subscribe({
      next: () => this.loadNotifications()
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => this.loadNotifications()
    });
  }

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  getDashboardLink(): string {
    const user = this.authService.currentUser();
    if (!user) return '/';
    switch (user.role) {
      case 'ROLE_STUDENT':
        return '/student/dashboard';
      case 'ROLE_RECRUITER':
        return '/recruiter/dashboard';
      case 'ROLE_ADMIN':
        return '/admin/dashboard';
      default:
        return '/';
    }
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
