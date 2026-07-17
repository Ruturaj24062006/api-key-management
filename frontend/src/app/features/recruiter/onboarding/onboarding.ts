import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecruiterProfileService, RecruiterProfileDto } from '../../../core/services/recruiter-profile.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-recruiter-onboarding',
  imports: [NgIf, FormsModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css'
})
export class RecruiterOnboarding implements OnInit {
  currentStep = signal<number>(1);
  totalSteps = 3;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  profile: RecruiterProfileDto = {
    jobTitle: '',
    companyName: '',
    logoUrl: '',
    websiteUrl: '',
    industry: '',
    location: '',
    description: ''
  };

  constructor(
    private readonly profileService: RecruiterProfileService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.profileService.getProfile().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          const d = res.data;
          this.profile = {
            jobTitle: d.jobTitle || '',
            companyName: d.companyName || '',
            logoUrl: d.logoUrl || '',
            websiteUrl: d.websiteUrl || '',
            industry: d.industry || '',
            location: d.location || '',
            description: d.description || ''
          };
          if (d.isVerified) {
            this.router.navigate(['/recruiter/dashboard']);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load profile', err);
        this.isLoading.set(false);
      }
    });
  }

  nextStep(): void {
    if (this.currentStep() === 1) {
      if (!this.profile.companyName) {
        this.errorMessage.set('Company Name is required.');
        return;
      }
    } else if (this.currentStep() === 2) {
      if (!this.profile.jobTitle || !this.profile.industry || !this.profile.location) {
        this.errorMessage.set('Job Title, Industry and Location are required.');
        return;
      }
    }
    this.errorMessage.set(null);
    this.currentStep.update(s => s + 1);

    if (this.currentStep() === 3) {
      this.submitOnboarding();
    }
  }

  prevStep(): void {
    this.errorMessage.set(null);
    this.currentStep.update(s => Math.max(1, s - 1));
  }

  submitOnboarding(): void {
    this.isLoading.set(true);
    this.profileService.onboard(this.profile).subscribe({
      next: (res) => {
        if (res.success) {
          setTimeout(() => {
            this.verifyCompany();
          }, 3500);
        } else {
          this.isLoading.set(false);
          this.errorMessage.set('Onboarding failed. Please try again.');
        }
      },
      error: (err) => {
        console.error('Failed to submit onboarding', err);
        this.isLoading.set(false);
        this.errorMessage.set('Error submitting profile. Please check parameters.');
        this.currentStep.set(2);
      }
    });
  }

  verifyCompany(): void {
    this.profileService.verify().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.router.navigate(['/recruiter/dashboard']);
        }
      },
      error: (err) => {
        console.error('Verification simulation failed', err);
        this.isLoading.set(false);
        this.router.navigate(['/recruiter/dashboard']);
      }
    });
  }
}
