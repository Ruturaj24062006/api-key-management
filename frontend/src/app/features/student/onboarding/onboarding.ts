import { Component, OnInit, OnDestroy, signal } from '@angular/core';
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
export class Onboarding implements OnInit, OnDestroy {
  currentStep = signal<number>(1);
  totalSteps = 7;
  isLoading = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Resume upload & processing state machine
  resumeUploadState = signal<'idle' | 'uploading' | 'processing' | 'extracting' | 'review' | 'success' | 'error'>('idle');
  extractedResumeProfile = signal<any | null>(null);
  latestResumeId = signal<string | null>(null);

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

  ngOnDestroy(): void {
    this.stopPollingResume();
  }

  // File Upload Integration
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.errorMessage.set('Please select a valid PDF resume.');
        return;
      }

      this.resumeUploadState.set('uploading');
      this.isUploading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);

      this.profileService.uploadResume(file).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.latestResumeId.set(res.data.id);
            this.resumeUploadState.set('processing');
            this.startPollingResume(res.data.id);
          } else {
            this.resumeUploadState.set('error');
            this.errorMessage.set('Failed to initialize resume processing.');
          }
        },
        error: (err) => {
          this.resumeUploadState.set('error');
          this.isUploading.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to upload resume. Please try again.');
        }
      });
    }
  }

  private pollIntervalId: any = null;

  startPollingResume(resumeId: string): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    let pollAttempts = 0;
    const maxPollAttempts = 30; // 60 seconds total

    this.pollIntervalId = setInterval(() => {
      pollAttempts++;
      if (pollAttempts > maxPollAttempts) {
        this.stopPollingResume();
        this.resumeUploadState.set('error');
        this.errorMessage.set('Resume processing timed out. Please try again or fill in the profile manually.');
        return;
      }

      // Transition visual text state
      if (pollAttempts > 3 && this.resumeUploadState() === 'processing') {
        this.resumeUploadState.set('extracting');
      }

      this.profileService.getLatestResume().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const resumeData = res.data;
            if (resumeData.extractedJson) {
              this.stopPollingResume();
              try {
                const parsedProfile = JSON.parse(resumeData.extractedJson);
                this.extractedResumeProfile.set(parsedProfile);
                this.resumeUploadState.set('review');
              } catch (e) {
                console.error('Failed to parse extracted JSON', e);
                this.resumeUploadState.set('error');
                this.errorMessage.set('Failed to parse the extracted resume details.');
              }
            }
          }
        },
        error: (err) => {
          console.warn('Polling latest resume error', err);
        }
      });
    }, 2000);
  }

  stopPollingResume(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.isUploading.set(false);
  }

  confirmExtractedData(): void {
    const resumeId = this.latestResumeId();
    if (!resumeId) {
      this.errorMessage.set('No active resume found to confirm.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.profileService.confirmResume(resumeId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.resumeUploadState.set('success');
        this.successMessage.set('Profile successfully updated from resume details!');
        
        // Reload student profile to sync form fields and completion percentage
        this.loadProfile();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to confirm resume details. Please try again.');
      }
    });
  }

  editExtractedData(): void {
    const extracted = this.extractedResumeProfile();
    if (!extracted) return;

    // Map extracted fields into local profile object
    if (extracted.firstName) this.profile.firstName = extracted.firstName;
    if (extracted.lastName) this.profile.lastName = extracted.lastName;
    if (extracted.bio) this.profile.bio = extracted.bio;
    if (extracted.githubUrl) this.profile.githubUrl = extracted.githubUrl;
    if (extracted.linkedinUrl) this.profile.linkedinUrl = extracted.linkedinUrl;
    if (extracted.portfolioUrl) this.profile.portfolioUrl = extracted.portfolioUrl;
    if (extracted.careerPreferences) this.profile.careerPreferences = extracted.careerPreferences;
    if (extracted.languages) this.profile.languages = extracted.languages;

    // Map Skills
    if (extracted.skills && Array.isArray(extracted.skills)) {
      this.profile.skills = extracted.skills.map((s: any) => ({
        name: s.name,
        proficiencyLevel: s.proficiencyLevel || 'INTERMEDIATE'
      }));
    }

    // Map Education
    if (extracted.education && Array.isArray(extracted.education)) {
      this.profile.education = extracted.education.map((e: any) => ({
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        gpa: e.gpa || undefined
      }));
    }

    // Map Experience
    if (extracted.experience && Array.isArray(extracted.experience)) {
      this.profile.experience = extracted.experience.map((ex: any) => ({
        companyName: ex.companyName,
        jobTitle: ex.jobTitle,
        startDate: ex.startDate || '',
        endDate: ex.endDate || '',
        description: ex.description || ''
      }));
    }

    // Map Projects
    if (extracted.projects && Array.isArray(extracted.projects)) {
      this.profile.projects = extracted.projects.map((p: any) => ({
        name: p.name,
        description: p.description || '',
        repoUrl: p.repoUrl || '',
        technologies: p.technologies || ''
      }));
    }

    // Inform the user and jump back to step 1 so they can edit
    this.successMessage.set('Extracted profile fields pre-populated! You can now review and edit details step-by-step.');
    setTimeout(() => this.successMessage.set(null), 5000);
    this.currentStep.set(1);
    this.resumeUploadState.set('idle');
  }

  resetUploadState(): void {
    this.resumeUploadState.set('idle');
    this.extractedResumeProfile.set(null);
    this.latestResumeId.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
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
