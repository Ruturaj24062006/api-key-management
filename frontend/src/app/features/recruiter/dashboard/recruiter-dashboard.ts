import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RecruiterProfileService, RecruiterProfileDto } from '../../../core/services/recruiter-profile.service';
import { JobService, JobCreateDto } from '../../../core/services/job.service';
import { JobApplicationsService } from '../../../core/services/job-applications.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';
import { NgIf, NgFor, NgClass, DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-recruiter-dashboard',
  imports: [Navbar, Footer, NgIf, NgFor, NgClass, DatePipe, SlicePipe, FormsModule],
  templateUrl: './recruiter-dashboard.html',
  styleUrl: './recruiter-dashboard.css'
})
export class RecruiterDashboard implements OnInit {
  profile: RecruiterProfileDto | null = null;
  stats = signal<any | null>(null);
  recentApplications = signal<any[]>([]);
  isLoadingStats = signal<boolean>(false);

  // Layout Tab System
  activeMenu = signal<string>('dashboard');
  expandedMenus = signal<Record<string, boolean>>({
    jobs: true,
    matching: true,
    applications: true
  });

  // Jobs Workspace
  myJobs = signal<any[]>([]);
  isLoadingJobs = signal<boolean>(false);
  
  // Job Form Data (Create/Edit/Duplicate)
  jobForm: JobCreateDto & { id?: string } = {
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
  jobStep = signal<number>(1);
  isSubmittingJob = signal<boolean>(false);
  isAiLoading = signal<boolean>(false);
  aiPrompt = '';
  jobErrorMessage = signal<string | null>(null);
  jobSuccessMessage = signal<string | null>(null);

  // Candidate Matching & Application Management
  selectedJobIdForMatching = signal<string>('');
  matchingCandidates = signal<any[]>([]);
  isLoadingCandidates = signal<boolean>(false);
  
  selectedJobIdForApplications = signal<string>('');
  selectedApplicationFilter = signal<string>('ALL'); // NEW, UNDER_REVIEW, INTERVIEW, REJECTED, SELECTED
  filteredApplications = signal<any[]>([]);
  
  selectedApplicantDetail = signal<any | null>(null);
  isActionModalOpen = signal<boolean>(false);
  actionType = ''; // 'SHORTLIST' | 'REJECT' | 'INTERVIEW'
  actionFeedback = '';
  interviewDate = '';
  interviewNote = '';

  // Company Profile Form
  companyForm = {
    companyName: '',
    industry: '',
    websiteUrl: '',
    location: '',
    description: '',
    logoUrl: ''
  };
  isUpdatingProfile = signal<boolean>(false);
  profileMessage = signal<string | null>(null);

  // Settings
  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  settingsMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly profileService: RecruiterProfileService,
    private readonly jobService: JobService,
    private readonly applicationsService: JobApplicationsService,
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
          
          // Populate company form
          this.companyForm = {
            companyName: profileData.companyName || '',
            industry: profileData.industry || '',
            websiteUrl: profileData.websiteUrl || '',
            location: profileData.location || '',
            description: profileData.description || '',
            logoUrl: profileData.logoUrl || ''
          };

          if (!profileData.isVerified || !profileData.companyName || !profileData.industry) {
            this.router.navigate(['/recruiter/onboarding']);
          } else {
            this.loadStats();
            this.loadMyJobs();
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

  loadMyJobs(): void {
    this.isLoadingJobs.set(true);
    this.jobService.getMyJobs().subscribe({
      next: (res) => {
        this.isLoadingJobs.set(false);
        if (res.success && Array.isArray(res.data)) {
          this.myJobs.set(res.data);
          
          // Auto select first job for matching/applications lists if none selected
          if (res.data.length > 0) {
            if (!this.selectedJobIdForMatching()) {
              this.selectedJobIdForMatching.set(res.data[0].id);
              this.loadMatchingCandidates();
            }
            if (!this.selectedJobIdForApplications()) {
              this.selectedJobIdForApplications.set(res.data[0].id);
              this.loadFilteredApplications();
            }
          }
        }
      },
      error: (err) => {
        this.isLoadingJobs.set(false);
        console.error('Error loading jobs:', err);
      }
    });
  }

  // Sidebar Menu Actions
  selectMenu(menu: string): void {
    this.activeMenu.set(menu);
    this.selectedApplicantDetail.set(null);
    this.jobErrorMessage.set(null);
    this.jobSuccessMessage.set(null);
    this.profileMessage.set(null);
    this.settingsMessage.set(null);

    if (menu === 'create-job') {
      this.resetJobForm();
    } else if (menu === 'all-jobs') {
      this.loadMyJobs();
    } else if (menu.startsWith('matching')) {
      this.loadMatchingCandidates();
    } else if (menu.startsWith('applications')) {
      // Map application submenus
      const sub = menu.split('-')[1] || 'ALL';
      this.selectedApplicationFilter.set(sub.toUpperCase());
      this.loadFilteredApplications();
    }
  }

  toggleSubmenu(menu: string): void {
    const curr = this.expandedMenus();
    this.expandedMenus.set({
      ...curr,
      [menu]: !curr[menu]
    });
  }

  // Job Management Logic
  resetJobForm(): void {
    this.jobForm = {
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
    this.jobStep.set(1);
    this.aiPrompt = '';
  }

  useAiAssist(): void {
    if (!this.aiPrompt.trim()) {
      this.jobErrorMessage.set('Please enter a role description for AI to assist with.');
      return;
    }
    this.jobErrorMessage.set(null);
    this.isAiLoading.set(true);

    this.jobService.aiAssist(this.aiPrompt).subscribe({
      next: (res) => {
        this.isAiLoading.set(false);
        if (res.success && res.data) {
          try {
            const data = JSON.parse(res.data);
            if (data.description) this.jobForm.description = data.description;
            if (data.requiredSkills) this.jobForm.requiredSkills = data.requiredSkills;
            if (data.preferredSkills) this.jobForm.preferredSkills = data.preferredSkills;
            if (data.experienceLevel) this.jobForm.experienceLevel = data.experienceLevel;
            this.jobSuccessMessage.set('✓ AI has successfully generated the job details. Review below.');
            setTimeout(() => this.jobSuccessMessage.set(null), 4000);
          } catch (e) {
            this.jobErrorMessage.set('AI returned unexpected format. Review manually.');
          }
        }
      },
      error: () => {
        this.isAiLoading.set(false);
        this.jobErrorMessage.set('AI assist failed. Please fill details manually.');
      }
    });
  }

  nextJobStep(): void {
    if (this.jobStep() === 1 && (!this.jobForm.title.trim() || !this.jobForm.description.trim())) {
      this.jobErrorMessage.set('Title and Description are required.');
      return;
    }
    this.jobErrorMessage.set(null);
    this.jobStep.update(s => s + 1);
  }

  prevJobStep(): void {
    this.jobStep.update(s => Math.max(1, s - 1));
  }

  submitJob(): void {
    this.isSubmittingJob.set(true);
    this.jobErrorMessage.set(null);

    const action = this.jobForm.id 
      ? this.jobService.updateJob(this.jobForm.id, this.jobForm)
      : this.jobService.createJob(this.jobForm);

    action.subscribe({
      next: (res) => {
        this.isSubmittingJob.set(false);
        if (res.success) {
          this.jobSuccessMessage.set(this.jobForm.id ? 'Job updated successfully!' : 'Job posted successfully!');
          setTimeout(() => {
            this.selectMenu('all-jobs');
          }, 1200);
        }
      },
      error: () => {
        this.isSubmittingJob.set(false);
        this.jobErrorMessage.set('Failed to save the job posting.');
      }
    });
  }

  editJob(job: any): void {
    this.jobForm = {
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements || '',
      location: job.location || '',
      jobType: job.jobType || 'FULL_TIME',
      experienceLevel: job.experienceLevel || '',
      salaryRange: job.salaryRange || '',
      requiredSkills: job.requiredSkills || '',
      preferredSkills: job.preferredSkills || '',
      workMode: job.workMode || 'HYBRID',
      educationLevel: job.educationLevel || '',
      sponsorshipAvailable: job.sponsorshipAvailable || false
    };
    this.jobStep.set(1);
    this.activeMenu.set('edit-job');
  }

  closeJob(jobId: string): void {
    if (confirm('Are you sure you want to close this job listing? Applicants will no longer be matched.')) {
      this.jobService.updateJobStatus(jobId, 'CLOSED').subscribe({
        next: () => {
          this.loadMyJobs();
          this.loadStats();
        }
      });
    }
  }

  duplicateJob(job: any): void {
    this.jobForm = {
      title: `${job.title} Copy`,
      description: job.description,
      requirements: job.requirements || '',
      location: job.location || '',
      jobType: job.jobType || 'FULL_TIME',
      experienceLevel: job.experienceLevel || '',
      salaryRange: job.salaryRange || '',
      requiredSkills: job.requiredSkills || '',
      preferredSkills: job.preferredSkills || '',
      workMode: job.workMode || 'HYBRID',
      educationLevel: job.educationLevel || '',
      sponsorshipAvailable: job.sponsorshipAvailable || false
    };
    this.jobStep.set(1);
    this.activeMenu.set('create-job');
  }

  // Candidate Matching Logic
  loadMatchingCandidates(): void {
    const jobId = this.selectedJobIdForMatching();
    if (!jobId) return;

    this.isLoadingCandidates.set(true);
    this.applicationsService.getJobApplications(jobId).subscribe({
      next: (res) => {
        this.isLoadingCandidates.set(false);
        if (res.success && Array.isArray(res.data)) {
          // Sort highest match score first
          this.matchingCandidates.set(res.data.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0)));
        }
      },
      error: () => {
        this.isLoadingCandidates.set(false);
      }
    });
  }

  onMatchingJobChange(): void {
    this.loadMatchingCandidates();
  }

  viewApplicantDetails(candidate: any): void {
    this.selectedApplicantDetail.set(candidate);
  }

  closeApplicantDetails(): void {
    this.selectedApplicantDetail.set(null);
  }

  // Action Drawer/Modals (Shortlist, Reject, Schedule Interview)
  openActionModal(type: string): void {
    this.actionType = type;
    this.actionFeedback = '';
    this.interviewDate = '';
    this.interviewNote = '';
    this.isActionModalOpen.set(true);
  }

  closeActionModal(): void {
    this.isActionModalOpen.set(false);
  }

  submitAction(): void {
    const candidate = this.selectedApplicantDetail();
    if (!candidate) return;

    let targetStatus = '';
    let feedback = this.actionFeedback || '';

    if (this.actionType === 'SHORTLIST') {
      targetStatus = 'SHORTLISTED';
    } else if (this.actionType === 'REJECT') {
      targetStatus = 'REJECTED';
    } else if (this.actionType === 'INTERVIEW') {
      targetStatus = 'INTERVIEW';
      feedback = `Interview scheduled on ${this.interviewDate}. Notes: ${this.interviewNote}`;
    }

    this.applicationsService.updateStatus(candidate.id, targetStatus, feedback).subscribe({
      next: (res) => {
        this.closeActionModal();
        if (res.success) {
          // Refresh views
          this.loadMatchingCandidates();
          this.loadFilteredApplications();
          this.loadStats();
          this.closeApplicantDetails();
        }
      }
    });
  }

  // Application Filtering
  loadFilteredApplications(): void {
    const jobId = this.selectedJobIdForApplications();
    if (!jobId) return;

    this.isLoadingCandidates.set(true);
    this.applicationsService.getJobApplications(jobId).subscribe({
      next: (res) => {
        this.isLoadingCandidates.set(false);
        if (res.success && Array.isArray(res.data)) {
          const filter = this.selectedApplicationFilter();
          if (filter === 'ALL') {
            this.filteredApplications.set(res.data);
          } else {
            this.filteredApplications.set(res.data.filter((app: any) => {
              if (filter === 'NEW') return app.status === 'APPLIED';
              if (filter === 'UNDER_REVIEW') return app.status === 'VIEWED';
              if (filter === 'INTERVIEW') return app.status === 'INTERVIEW';
              if (filter === 'REJECTED') return app.status === 'REJECTED';
              if (filter === 'SELECTED') return app.status === 'OFFER' || app.status === 'ACCEPTED';
              return true;
            }));
          }
        }
      },
      error: () => {
        this.isLoadingCandidates.set(false);
      }
    });
  }

  onApplicationJobChange(): void {
    this.loadFilteredApplications();
  }

  // Edit Company Details
  saveCompanyProfile(): void {
    this.isUpdatingProfile.set(true);
    this.profileMessage.set(null);

    this.profileService.onboard(this.companyForm as any).subscribe({
      next: (res: any) => {
        this.isUpdatingProfile.set(false);
        if (res.success) {
          this.profileMessage.set('✓ Company profile updated successfully.');
          this.checkOnboardingStatus();
        }
      },
      error: () => {
        this.isUpdatingProfile.set(false);
        this.profileMessage.set('Failed to update company details.');
      }
    });
  }

  // Settings
  updatePassword(): void {
    this.settingsMessage.set(null);
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.settingsMessage.set('New passwords do not match.');
      return;
    }

    this.settingsMessage.set('✓ Password updated successfully (mock update).');
    this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  // Style helper mapping
  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      APPLIED: 'New',
      VIEWED: 'Under Review',
      SHORTLISTED: 'Shortlisted',
      INTERVIEW: 'Interview',
      OFFER: 'Offer',
      ACCEPTED: 'Selected',
      REJECTED: 'Rejected',
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      APPLIED: 'status-new',
      VIEWED: 'status-viewed',
      SHORTLISTED: 'status-shortlisted',
      INTERVIEW: 'status-interview',
      OFFER: 'status-offer',
      ACCEPTED: 'status-selected',
      REJECTED: 'status-rejected',
    };
    return map[status] || '';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
