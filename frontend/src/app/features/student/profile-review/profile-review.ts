import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentProfileService } from '../../../core/services/student-profile.service';
import { JobMatchesService } from '../../../core/services/job-matches.service';

@Component({
  selector: 'app-profile-review',
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './profile-review.html',
  styleUrl: './profile-review.css'
})
export class ProfileReview implements OnInit {
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  resumeId = signal<string | null>(null);

  // Extracted Profile data structure
  profileData = signal<any>({
    firstName: '',
    lastName: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    languages: '',
    skills: [],
    education: [],
    experience: [],
    projects: [],
    certifications: []
  });

  // Additional fields for Step 5: Profile Completion (plain props for ngModel compatibility)
  preferredRole = '';
  preferredCity = '';
  expectedSalary = '';
  employmentType = 'FULL_TIME';
  workMode = 'HYBRID';

  constructor(
    private readonly profileService: StudentProfileService,
    private readonly matchesService: JobMatchesService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.fetchExtractedData();
  }

  fetchExtractedData(): void {
    this.isLoading.set(true);
    this.profileService.getLatestResume().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const resume = res.data;
        if (resume) {
          this.resumeId.set(resume.id);
          if (resume.extractedJson) {
            try {
              const parsed = JSON.parse(resume.extractedJson);
              this.profileData.set({
                firstName: parsed.firstName || '',
                lastName: parsed.lastName || '',
                githubUrl: parsed.githubUrl || '',
                linkedinUrl: parsed.linkedinUrl || '',
                portfolioUrl: parsed.portfolioUrl || '',
                languages: parsed.languages || '',
                skills: parsed.skills || [],
                education: parsed.education || [],
                experience: parsed.experience || [],
                projects: parsed.projects || [],
                certifications: parsed.certifications || []
              });

              // Pre-fill preferences if any
              if (parsed.careerPreferences) {
                this.preferredRole = parsed.careerPreferences;
              }
            } catch (e) {
              console.error('Failed to parse extracted JSON:', e);
              this.errorMessage.set('Failed to parse extracted resume data. Please fill out details manually.');
            }
          }
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to load extracted resume profile. Please try uploading again.');
      }
    });
  }

  // Field status checks for visual badges
  hasField(val: any): boolean {
    if (Array.isArray(val)) {
      return val.length > 0;
    }
    return val !== null && val !== undefined && val.toString().trim() !== '';
  }

  // Manual list adjustments
  addSkill(): void {
    const current = this.profileData();
    current.skills.push({ name: '', proficiencyLevel: 'INTERMEDIATE' });
    this.profileData.set({ ...current });
  }

  removeSkill(idx: number): void {
    const current = this.profileData();
    current.skills.splice(idx, 1);
    this.profileData.set({ ...current });
  }

  addEducation(): void {
    const current = this.profileData();
    current.education.push({ institution: '', degree: '', fieldOfStudy: '', gpa: null, startDate: '', endDate: '' });
    this.profileData.set({ ...current });
  }

  removeEducation(idx: number): void {
    const current = this.profileData();
    current.education.splice(idx, 1);
    this.profileData.set({ ...current });
  }

  addExperience(): void {
    const current = this.profileData();
    current.experience.push({ companyName: '', jobTitle: '', description: '', startDate: '', endDate: '' });
    this.profileData.set({ ...current });
  }

  removeExperience(idx: number): void {
    const current = this.profileData();
    current.experience.splice(idx, 1);
    this.profileData.set({ ...current });
  }

  addProject(): void {
    const current = this.profileData();
    current.projects.push({ name: '', description: '', repoUrl: '', technologies: '' });
    this.profileData.set({ ...current });
  }

  removeProject(idx: number): void {
    const current = this.profileData();
    current.projects.splice(idx, 1);
    this.profileData.set({ ...current });
  }

  addCertification(): void {
    const current = this.profileData();
    current.certifications.push({ name: '', issuingOrganization: '', issueDate: '', expirationDate: '' });
    this.profileData.set({ ...current });
  }

  removeCertification(idx: number): void {
    const current = this.profileData();
    current.certifications.splice(idx, 1);
    this.profileData.set({ ...current });
  }

  onSubmit(): void {
    const resumeId = this.resumeId();
    if (!resumeId) {
      this.errorMessage.set('No active resume found to confirm.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Save preferences inside profile data payload
    const finalProfile = { ...this.profileData() };
    const prefs = [
      this.preferredRole ? `Role: ${this.preferredRole}` : '',
      this.preferredCity ? `City: ${this.preferredCity}` : '',
      this.workMode ? `Mode: ${this.workMode}` : '',
      this.expectedSalary ? `Salary: ${this.expectedSalary}` : '',
      this.employmentType ? `Type: ${this.employmentType}` : ''
    ].filter(Boolean).join('; ');
    
    finalProfile.careerPreferences = prefs;

    // 1. Confirm and save the profile structure in the backend
    this.profileService.confirmResume(resumeId).subscribe({
      next: () => {
        // 2. Also save secondary preferences by updating student profile directly
        const studentDto: any = {
          firstName: finalProfile.firstName,
          lastName: finalProfile.lastName,
          bio: `Actively searching for ${this.preferredRole || 'opportunities'}.`,
          githubUrl: finalProfile.githubUrl,
          linkedinUrl: finalProfile.linkedinUrl,
          portfolioUrl: finalProfile.portfolioUrl,
          careerPreferences: prefs,
          languages: finalProfile.languages,
          skills: finalProfile.skills,
          projects: finalProfile.projects,
          experience: finalProfile.experience,
          education: finalProfile.education,
          profileCompletedPct: 100
        };

        this.profileService.updateProfile(studentDto).subscribe({
          next: () => {
            // 3. Re-trigger the matches scoring engine
            this.matchesService.generateMatches().subscribe({
              next: () => {
                this.isLoading.set(false);
                this.successMessage.set('Profile verified and job recommendations generated successfully!');
                setTimeout(() => {
                  this.router.navigate(['/student/dashboard']);
                }, 1500);
              },
              error: (err) => {
                // Matches generation failed but profile is saved, proceed to dashboard anyway
                this.isLoading.set(false);
                this.router.navigate(['/student/dashboard']);
              }
            });
          },
          error: (err) => {
            this.isLoading.set(false);
            this.errorMessage.set(err.error?.message || 'Failed to update student preferences.');
          }
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to confirm profile details.');
      }
    });
  }
}
