import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { StudentProfileService } from '../../../core/services/student-profile.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';

@Component({
  selector: 'app-student-dashboard',
  imports: [Navbar, Footer],
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.css'
})
export class StudentDashboard implements OnInit {
  constructor(
    private readonly authService: AuthService,
    private readonly profileService: StudentProfileService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.checkProfileCompleteness();
  }

  checkProfileCompleteness(): void {
    this.profileService.getProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const completedPct = res.data.profileCompletedPct;
          if (completedPct < 85) {
            this.router.navigate(['/student/onboarding']);
          }
        }
      },
      error: (err) => {
        console.error('Error fetching profile completeness:', err);
      }
    });
  }

  getUserEmail(): string {
    return this.authService.currentUser()?.email || 'N/A';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
