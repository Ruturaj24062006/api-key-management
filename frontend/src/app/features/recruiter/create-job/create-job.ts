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
  totalSteps = 4;
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
    experienceLevel: 'Entry-level',
    salaryRange: '',
    requiredSkills: '',
    preferredSkills: '',
    workMode: 'HYBRID',
    educationLevel: "Bachelor's",
    sponsorshipAvailable: false,
    department: '',
    gpaCutoff: undefined,
    deadline: ''
  };

  requiredSkillsArray: string[] = [];
  newRequiredSkill = '';

  salaryMin: number | null = null;
  salaryMax: number | null = null;

  jobTypes = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'];
  workModes = ['ONSITE', 'HYBRID', 'REMOTE'];

  constructor(
    private readonly jobService: JobService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {}

  addRequiredSkill(): void {
    const s = this.newRequiredSkill.trim();
    if (s) {
      if (!this.requiredSkillsArray.includes(s)) {
        this.requiredSkillsArray.push(s);
        this.job.requiredSkills = this.requiredSkillsArray.join(', ');
      }
      this.newRequiredSkill = '';
      this.errorMessage.set(null);
    }
  }

  removeRequiredSkill(index: number): void {
    this.requiredSkillsArray.splice(index, 1);
    this.job.requiredSkills = this.requiredSkillsArray.join(', ');
  }

  nextStep(): void {
    this.errorMessage.set(null);
    if (this.currentStep() === 1) {
      if (!this.job.title.trim()) {
        this.errorMessage.set('Job Title is required.');
        return;
      }
      if (!this.job.description.trim()) {
        this.errorMessage.set('Job Description is required.');
        return;
      }
    } else if (this.currentStep() === 2) {
      if (!this.job.location?.trim()) {
        this.errorMessage.set('Location is required.');
        return;
      }
    } else if (this.currentStep() === 3) {
      if (this.requiredSkillsArray.length === 0) {
        this.errorMessage.set('At least one required skill is required.');
        return;
      }
    }
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
            if (data.requiredSkills) {
              this.job.requiredSkills = data.requiredSkills;
              this.requiredSkillsArray = data.requiredSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
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
    if (this.requiredSkillsArray.length === 0) {
      this.errorMessage.set('At least one required skill is required.');
      return;
    }

    if (this.salaryMin !== null || this.salaryMax !== null) {
      const min = this.salaryMin !== null ? `₹${this.salaryMin} LPA` : '';
      const max = this.salaryMax !== null ? `₹${this.salaryMax} LPA` : '';
      if (min && max) {
        this.job.salaryRange = `${min} - ${max}`;
      } else {
        this.job.salaryRange = min || max;
      }
    } else {
      this.job.salaryRange = '';
    }

    // Map local deadline string to ISO format if set
    if (this.job.deadline) {
      this.job.deadline = new Date(this.job.deadline).toISOString();
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.jobService.createJob(this.job).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.currentStep.set(5); // Success state
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
