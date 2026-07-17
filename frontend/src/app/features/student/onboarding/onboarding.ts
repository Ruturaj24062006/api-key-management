import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor, LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentProfileService, StudentProfileDto, EducationDto, ExperienceDto, ProjectDto, SkillDto } from '../../../core/services/student-profile.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-onboarding',
  imports: [NgIf, NgFor, LowerCasePipe, FormsModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css'
})
export class Onboarding implements OnInit {
  currentStep = signal<number>(1);
  totalSteps = 7;
  isLoading = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Profile state matching the DTO
  profile: StudentProfileDto = {
    firstName: '',
    lastName: '',
    bio: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    careerPreferences: '',
    languages: '',
    profileCompletedPct: 0,
    skills: [],
    projects: [],
    experience: [],
    education: []
  };

  // Temporary objects for inputs
  newEducation: EducationDto = this.createEmptyEducation();
  newExperience: ExperienceDto = this.createEmptyExperience();
  newProject: ProjectDto = this.createEmptyProject();
  newSkill: SkillDto = { name: '', proficiencyLevel: 'INTERMEDIATE' };

  constructor(
    private readonly profileService: StudentProfileService,
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
          this.profile = res.data;
          
          // Pre-populate names from registered session if blank
          const session = this.authService.currentUser();
          if (session && !this.profile.firstName) {
            // Split simple credentials name if exists, or leave blank
            this.profile.firstName = session.email.split('@')[0];
          }
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to load profile. Please refresh the page.');
      }
    });
  }

  // Navigation Methods
  nextStep(): void {
    this.saveProgress(() => {
      if (this.currentStep() < this.totalSteps) {
        this.currentStep.update(s => s + 1);
      } else {
        // Complete onboarding: if completion >= 85, mark onboarding done
        this.router.navigate(['/student/dashboard']);
      }
    });
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      this.saveProgress(() => {
        this.currentStep.set(step);
      });
    }
  }

  // Dynamic Array Modifiers
  addEducation(): void {
    if (!this.newEducation.institution || !this.newEducation.degree) {
      this.errorMessage.set('Institution and Degree are required.');
      return;
    }
    this.profile.education.push({ ...this.newEducation });
    this.newEducation = this.createEmptyEducation();
    this.errorMessage.set(null);
  }

  removeEducation(index: number): void {
    this.profile.education.splice(index, 1);
  }

  addExperience(): void {
    if (!this.newExperience.companyName || !this.newExperience.jobTitle) {
      this.errorMessage.set('Company Name and Job Title are required.');
      return;
    }
    this.profile.experience.push({ ...this.newExperience });
    this.newExperience = this.createEmptyExperience();
    this.errorMessage.set(null);
  }

  removeExperience(index: number): void {
    this.profile.experience.splice(index, 1);
  }

  addProject(): void {
    if (!this.newProject.name) {
      this.errorMessage.set('Project Name is required.');
      return;
    }
    this.profile.projects.push({ ...this.newProject });
    this.newProject = this.createEmptyProject();
    this.errorMessage.set(null);
  }

  removeProject(index: number): void {
    this.profile.projects.splice(index, 1);
  }

  addSkill(): void {
    if (!this.newSkill.name) {
      this.errorMessage.set('Skill Name is required.');
      return;
    }
    this.profile.skills.push({ ...this.newSkill });
    this.newSkill = { name: '', proficiencyLevel: 'INTERMEDIATE' };
    this.errorMessage.set(null);
  }

  removeSkill(index: number): void {
    this.profile.skills.splice(index, 1);
  }

  // Save Progress to Backend
  saveProgress(onSuccess?: () => void): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.profileService.updateProfile(this.profile).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.profile = res.data;
          this.successMessage.set('Progress saved.');
          setTimeout(() => this.successMessage.set(null), 2000);
          if (onSuccess) onSuccess();
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to save progress. Please try again.');
      }
    });
  }

  // File Upload Integration
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.errorMessage.set('Please select a valid PDF resume.');
        return;
      }

      this.isUploading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);

      this.profileService.uploadResume(file).subscribe({
        next: (res) => {
          this.isUploading.set(false);
          this.successMessage.set('Resume uploaded successfully! Parsing details in background...');
          // Poll profile details after 5 seconds to load parsed data
          setTimeout(() => this.loadProfile(), 5000);
        },
        error: (err) => {
          this.isUploading.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to upload resume. Please try again.');
        }
      });
    }
  }

  // Progress Bar Helper Characters: ████████░░░░
  getProgressBlocks(): string {
    const completedPct = this.profile.profileCompletedPct;
    const totalBlocks = 12;
    const activeBlocks = Math.round((completedPct / 100) * totalBlocks);
    const inactiveBlocks = totalBlocks - activeBlocks;
    
    return '█'.repeat(activeBlocks) + '░'.repeat(inactiveBlocks);
  }

  private createEmptyEducation(): EducationDto {
    return { institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', gpa: undefined };
  }

  private createEmptyExperience(): ExperienceDto {
    return { companyName: '', jobTitle: '', startDate: '', endDate: '', description: '' };
  }

  private createEmptyProject(): ProjectDto {
    return { name: '', description: '', repoUrl: '', technologies: '' };
  }
}
