import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobService, JobCreateDto } from '../../../core/services/job.service';
import { AuthService } from '../../../core/services/auth.service';
import { Navbar } from '../../../shared/components/navbar/navbar';

@Component({
  selector: 'app-create-job',
  imports: [Navbar, NgIf, NgFor, FormsModule],
  templateUrl: './create-job.html',
  styleUrl: './create-job.css'
})
export class CreateJob implements OnInit {
  currentStep = signal<number>(1);
  totalSteps = 3;
  isLoading = signal<boolean>(false);
  isAiLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  aiPrompt = '';

  job: JobCreateDto = {
    title: '',
    description: '',
    requirements: '',
    location: '',
    jobType: 'FULL_TIME',
    experienceLevel: '',
    salaryRange: '',
    requiredSkills: '',
    preferredSkills: '',
    workMode: 'HYBRID',
    educationLevel: '',
    sponsorshipAvailable: false
  };

  jobTypes = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'REMOTE'];
  workModes = ['ONSITE', 'HYBRID', 'REMOTE'];

  constructor(
    private readonly jobService: JobService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {}

  nextStep(): void {
    if (this.currentStep() === 1) {
      if (!this.job.title.trim()) {
        this.errorMessage.set('Job Title is required.');
        return;
      }
      if (!this.job.description.trim()) {
        this.errorMessage.set('Job Description is required.');
        return;
      }
    }
    this.errorMessage.set(null);
    this.currentStep.update(s => Math.min(this.totalSteps, s + 1));
  }

  prevStep(): void {
    this.errorMessage.set(null);
    this.currentStep.update(s => Math.max(1, s - 1));
  }

  useAiAssist(): void {
    if (!this.aiPrompt.trim()) {
      this.errorMessage.set('Please enter a role description for AI to assist with.');
      return;
    }
    this.errorMessage.set(null);
    this.isAiLoading.set(true);

    this.jobService.aiAssist(this.aiPrompt).subscribe({
      next: (res) => {
        this.isAiLoading.set(false);
        if (res.success && res.data) {
          try {
            const data = JSON.parse(res.data);
            if (data.description) this.job.description = data.description;
            if (data.requiredSkills) this.job.requiredSkills = data.requiredSkills;
            if (data.preferredSkills) this.job.preferredSkills = data.preferredSkills;
            if (data.experienceLevel) this.job.experienceLevel = data.experienceLevel;
            this.successMessage.set('✓ AI has generated the job details. Review and edit as needed.');
            setTimeout(() => this.successMessage.set(null), 4000);
          } catch (e) {
            this.errorMessage.set('AI returned unexpected format. Please try again.');
          }
        }
      },
      error: (err) => {
        this.isAiLoading.set(false);
        this.errorMessage.set('AI assist failed. Please fill in the details manually.');
        console.error(err);
      }
    });
  }

  submitJob(): void {
    if (!this.job.title || !this.job.description || !this.job.jobType) {
      this.errorMessage.set('Title, Description, and Job Type are required.');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.jobService.createJob(this.job).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.currentStep.set(4); // Success state
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to post the job. Please try again.');
        console.error(err);
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/recruiter/dashboard']);
  }
}
