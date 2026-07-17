import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RecruiterProfileService, RecruiterProfileDto } from '../../../core/services/recruiter-profile.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';

@Component({
  selector: 'app-recruiter-dashboard',
  imports: [Navbar, Footer, NgIf, NgFor, NgClass, DatePipe],
  templateUrl: './recruiter-dashboard.html',
  styleUrl: './recruiter-dashboard.css'
})
export class RecruiterDashboard implements OnInit {
  profile: RecruiterProfileDto | null = null;
  stats = signal<any | null>(null);
  recentApplications = signal<any[]>([]);
  isLoadingStats = signal<boolean>(false);

  constructor(
    private readonly authService: AuthService,
    private readonly profileService: RecruiterProfileService,
    public readonly router: Router
  ) {}

  ngOnInit(): void {
    this.checkOnboardingStatus();
  }

  checkOnboardingStatus(): void {
    this.profileService.getProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const profileData = res.data;
          this.profile = profileData;
          if (!profileData.isVerified || !profileData.companyName || !profileData.industry) {
            this.router.navigate(['/recruiter/onboarding']);
          } else {
            this.loadStats();
          }
        }
      },
      error: (err) => {
        console.error('Error fetching recruiter profile onboarding status:', err);
      }
    });
  }

  loadStats(): void {
    this.isLoadingStats.set(true);
    this.profileService.getDashboardStats().subscribe({
      next: (res) => {
        this.isLoadingStats.set(false);
        if (res.success && res.data) {
          this.stats.set(res.data);
          this.recentApplications.set(res.data.recentApplications || []);
        }
      },
      error: (err) => {
        this.isLoadingStats.set(false);
        console.error('Error loading dashboard stats:', err);
      }
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      APPLIED: 'Applied',
      VIEWED: 'Under Review',
      SHORTLISTED: 'Shortlisted',
      INTERVIEW: 'Interview',
      OFFER: 'Offer',
      ACCEPTED: 'Accepted',
      REJECTED: 'Rejected',
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      APPLIED: 'status-applied',
      VIEWED: 'status-viewed',
      SHORTLISTED: 'status-shortlisted',
      INTERVIEW: 'status-interview',
      OFFER: 'status-offer',
      ACCEPTED: 'status-accepted',
      REJECTED: 'status-rejected',
    };
    return map[status] || '';
  }

  getUserEmail(): string {
    return this.authService.currentUser()?.email || 'N/A';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
