import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor, LowerCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { StudentProfileService, StudentProfileDto } from '../../../core/services/student-profile.service';
import { JobMatchesService, MatchResponse, MatchDetailsResponse } from '../../../core/services/job-matches.service';
import { JobApplicationsService } from '../../../core/services/job-applications.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';

@Component({
  selector: 'app-student-dashboard',
  imports: [Navbar, Footer, NgIf, NgFor, LowerCasePipe, FormsModule, DatePipe],
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.css'
})
export class StudentDashboard implements OnInit, OnDestroy {
  // Signals for state management
  profile = signal<StudentProfileDto | null>(null);
  matches = signal<MatchResponse[]>([]);
  applicationsCount = signal<number>(0);
  averageMatchScore = signal<number>(0);
  greetingText = signal<string>('Good morning');
  
  // Modal signals
  selectedMatch = signal<MatchDetailsResponse | null>(null);
  isDetailsModalOpen = signal<boolean>(false);
  isAiLoading = signal<boolean>(false);
  aiExplanation = signal<string | null>(null);
  aiSkillGap = signal<any | null>(null);

  // Tab & search filtering signals
  activeTab = signal<'recommendations' | 'discover' | 'applications'>('recommendations');
  searchRole = signal<string>('');
  searchLocation = signal<string>('');
  filterExperience = signal<string>('');
  filterJobType = signal<string>('');
  filterSalary = signal<string>('');
  filterSkills = signal<string>('');
  filterSponsorship = signal<boolean>(false);
  sortOption = signal<string>('BEST_MATCH');

  searchResults = signal<MatchResponse[]>([]);
  isSearchLoading = signal<boolean>(false);

  // Job Board & Bookmark signals
  selectedJobBoard = signal<string>('All Matches');
  savedJobIds = signal<Set<string>>(new Set());

  // Upload & Review Popup Modal signals
  isUploadModalOpen = signal<boolean>(false);
  uploadStep = signal<'select' | 'uploading' | 'review'>('select');
  uploadProgress = signal<number>(0);
  uploadError = signal<string | null>(null);
  extractedData = signal<any>(null);
  currentResumeId = signal<string | null>(null);
  private modalPollIntervalId: any = null;

  // Review editable fields
  reviewRole: string = '';
  reviewCity: string = '';
  reviewExperience: string = '';
  reviewWorkMode: string = 'HYBRID';

  // AI Chat signals
  isAiChatOpen = signal<boolean>(false);
  aiChatMessages = signal<{ sender: 'user' | 'ai', text: string }[]>([]);
  userQuestionText = signal<string>('');
  isAiResponding = signal<boolean>(false);

  // Application flow signals
  appliedJobIds = signal<Set<string>>(new Set());
  myApplications = signal<any[]>([]);
  isApplyModalOpen = signal<boolean>(false);
  applyJobId = signal<string>('');
  applyJobTitle = signal<string>('');
  applyCompanyName = signal<string>('');
  coverLetterText = signal<string>('');
  isSubmittingApplication = signal<boolean>(false);
  applicationSuccess = signal<boolean>(false);

  applicationsFilter = signal<string>('ALL');

  filteredApplications = computed(() => {
    const list = this.myApplications();
    const filter = this.applicationsFilter();
    if (filter === 'ALL') {
      return list;
    }
    return list.filter((app: any) => {
      if (!app.status) return false;
      const status = app.status.toUpperCase();
      switch (filter) {
        case 'APPLIED':
          return status === 'APPLIED';
        case 'UNDER_REVIEW':
          return status === 'VIEWED';
        case 'SHORTLISTED':
          return status === 'SHORTLISTED';
        case 'INTERVIEW':
          return status === 'INTERVIEW';
        case 'SELECTED':
          return status === 'OFFER' || status === 'ACCEPTED';
        case 'REJECTED':
          return status === 'REJECTED';
        default:
          return false;
      }
    });
  });

  constructor(
    private readonly authService: AuthService,
    private readonly profileService: StudentProfileService,
    private readonly matchesService: JobMatchesService,
    private readonly applicationsService: JobApplicationsService,
    public readonly router: Router
  ) {}

  ngOnInit(): void {
    this.updateGreeting();
    this.checkProfileCompletenessAndLoad();
  }

  ngOnDestroy(): void {
    this.stopModalPolling();
  }

  updateGreeting(): void {
    const hours = new Date().getHours();
    if (hours < 12) {
      this.greetingText.set('Good morning');
    } else if (hours < 18) {
      this.greetingText.set('Good afternoon');
    } else {
      this.greetingText.set('Good evening');
    }
  }

  checkProfileCompletenessAndLoad(): void {
    this.profileService.getProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const profileData = res.data;
          this.profile.set(profileData);
        } else {
          this.profile.set({
            id: '00000000-0000-0000-0000-000000000000',
            firstName: this.getStudentName(),
            lastName: '',
            profileCompletedPct: 0
          } as any);
        }
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Error fetching profile completeness, fallback to mock...', err);
        this.loadMockProfileAndDashboard();
      }
    });
  }

  navigateToResumeUpload(): void {
    this.router.navigate(['/student/resume-upload']);
  }

  private loadMockProfileAndDashboard(): void {
    this.profile.set({
      id: '00000000-0000-0000-0000-000000000000',
      firstName: this.getStudentName(),
      lastName: '',
      profileCompletedPct: 0
    } as any);
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    // 1. Fetch submitted applications count and list details
    this.applicationsService.getMyApplications().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.myApplications.set(res.data);
          this.applicationsCount.set(res.data.length);
          
          const ids = new Set<string>();
          res.data.forEach((app: any) => {
            if (app.jobId) {
              ids.add(app.jobId);
            } else if (app.job && app.job.id) {
              ids.add(app.job.id);
            }
          });
          this.appliedJobIds.set(ids);
        } else {
          this.myApplications.set([]);
          this.applicationsCount.set(0);
        }
      },
      error: (err) => {
        console.warn('Failed to load student applications:', err);
        this.myApplications.set([]);
        this.applicationsCount.set(0);
      }
    });

    // 2. Fetch or Generate Job Matches
    this.matchesService.getMatches().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.processMatches(res.data);
        } else {
          this.triggerMatchGeneration();
        }
      },
      error: (err) => {
        console.warn('No matches fetched:', err);
        this.processMatches([]);
      }
    });
  }

  triggerMatchGeneration(): void {
    this.matchesService.generateMatches().subscribe({
      next: () => {
        this.matchesService.getMatches().subscribe({
          next: (mRes) => {
            if (mRes.success && Array.isArray(mRes.data)) {
              this.processMatches(mRes.data);
            } else {
              this.processMatches([]);
            }
          },
          error: () => this.processMatches([])
        });
      },
      error: (err) => {
        console.error('Failed to generate matches:', err);
        this.processMatches([]);
      }
    });
  }

  processMatches(matchList: MatchResponse[]): void {
    this.matches.set(matchList);
    
    // Compute average match score
    if (matchList.length > 0) {
      const sum = matchList.reduce((acc, curr) => acc + curr.compositeScore, 0);
      const avg = Math.round(sum / matchList.length);
      this.averageMatchScore.set(avg);
    } else {
      this.averageMatchScore.set(0);
    }
  }

  viewMatchDetails(matchId: string): void {
    this.isDetailsModalOpen.set(true);
    this.selectedMatch.set(null);
    this.aiExplanation.set(null);
    this.aiSkillGap.set(null);
    
    this.matchesService.getMatchDetails(matchId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selectedMatch.set(res.data);
        }
      },
      error: (err) => {
        console.error('Failed to load match details', err);
        this.isDetailsModalOpen.set(false);
      }
    });
  }

  askAiMatch(matchId: string, event: Event): void {
    // Prevent event bubbling so it doesn't trigger cards row clicks
    event.stopPropagation();
    
    this.isDetailsModalOpen.set(true);
    this.selectedMatch.set(null);
    this.isAiLoading.set(true);
    this.aiExplanation.set(null);
    this.aiSkillGap.set(null);

    this.matchesService.getMatchDetails(matchId).subscribe({
      next: (res) => {
        this.isAiLoading.set(false);
        if (res.success && res.data) {
          const data = res.data;
          this.selectedMatch.set(data);
          this.aiExplanation.set(data.explanation);
          
          if (data.skillGap) {
            try {
              this.aiSkillGap.set(JSON.parse(data.skillGap));
            } catch (e) {
              console.error('Failed to parse skill gap JSON', e);
            }
          }
          this.openAiChat();
          this.sendQuestion('Why did I get this score?');
        }
      },
      error: (err) => {
        console.error('Failed to enrich match with AI', err);
        this.isAiLoading.set(false);
        this.isDetailsModalOpen.set(false);
      }
    });
  }

  closeModal(): void {
    this.isDetailsModalOpen.set(false);
    this.selectedMatch.set(null);
    this.aiExplanation.set(null);
    this.aiSkillGap.set(null);
    this.isAiChatOpen.set(false);
    this.aiChatMessages.set([]);
  }

  openAiChat(): void {
    this.aiChatMessages.set([
      { sender: 'ai', text: `Hi! I am your career coach AI. Ask me anything about this job (e.g. why did I get this score, what skills am I missing, should I apply, etc.)!` }
    ]);
    this.isAiChatOpen.set(true);
  }

  closeAiChat(): void {
    this.isAiChatOpen.set(false);
  }

  sendQuestion(customQuestion?: string): void {
    const question = (customQuestion || this.userQuestionText()).trim();
    if (!question) return;

    this.aiChatMessages.update(msgs => [...msgs, { sender: 'user', text: question }]);
    this.userQuestionText.set('');
    this.isAiResponding.set(true);

    const match = this.selectedMatch();
    if (!match) {
      this.isAiResponding.set(false);
      return;
    }

    this.matchesService.askAi(match.id, question).subscribe({
      next: (res) => {
        this.isAiResponding.set(false);
        if (res.success && res.data) {
          this.aiChatMessages.update(msgs => [...msgs, { sender: 'ai', text: res.data }]);
        } else {
          this.aiChatMessages.update(msgs => [...msgs, { sender: 'ai', text: 'I encountered an error analyzing this job. Please try again.' }]);
        }
      },
      error: (err) => {
        console.error('Failed to ask AI', err);
        this.isAiResponding.set(false);
        this.aiChatMessages.update(msgs => [...msgs, { sender: 'ai', text: 'Sorry, I failed to reach the AI assistant. Check your connection.' }]);
      }
    });
  }

  selectQuickQuestion(question: string): void {
    this.sendQuestion(question);
  }

  changeTab(tab: 'recommendations' | 'discover' | 'applications'): void {
    this.activeTab.set(tab);
    if (tab === 'discover' && this.searchResults().length === 0) {
      this.searchJobs();
    }
  }

  searchJobs(): void {
    this.isSearchLoading.set(true);

    const params: any = {
      sortBy: this.sortOption()
    };

    if (this.searchRole().trim()) params.role = this.searchRole().trim();
    if (this.searchLocation().trim()) params.location = this.searchLocation().trim();
    if (this.filterExperience()) params.experienceLevel = this.filterExperience();
    if (this.filterJobType()) params.jobType = this.filterJobType();
    if (this.filterSalary().trim()) params.salary = this.filterSalary().trim();
    if (this.filterSkills().trim()) params.skills = this.filterSkills().trim();
    if (this.filterSponsorship()) params.sponsorship = this.filterSponsorship();

    this.matchesService.searchMatches(params).subscribe({
      next: (res) => {
        this.isSearchLoading.set(false);
        if (res.success && Array.isArray(res.data)) {
          this.searchResults.set(res.data);
        } else {
          this.searchResults.set([]);
        }
      },
      error: (err) => {
        console.error('Failed to search jobs', err);
        this.isSearchLoading.set(false);
        this.searchResults.set([]);
      }
    });
  }

  resetFilters(): void {
    this.searchRole.set('');
    this.searchLocation.set('');
    this.filterExperience.set('');
    this.filterJobType.set('');
    this.filterSalary.set('');
    this.filterSkills.set('');
    this.filterSponsorship.set(false);
    this.sortOption.set('BEST_MATCH');
    this.searchJobs();
  }

  toggleBookmark(jobId: string, event: Event): void {
    event.stopPropagation();
    const set = new Set(this.savedJobIds());
    if (set.has(jobId)) {
      set.delete(jobId);
    } else {
      set.add(jobId);
    }
    this.savedJobIds.set(set);
  }

  isBookmarked(jobId: string): boolean {
    return this.savedJobIds().has(jobId);
  }

  getFitLabel(score: number): string {
    if (score >= 80) return 'Great Fit';
    if (score >= 60) return 'Good Fit';
    return 'Potential Fit';
  }

  getSkillsList(skillsStr?: string): string[] {
    if (!skillsStr) return [];
    return skillsStr.split(',').map(s => s.trim()).filter(Boolean);
  }

  selectJobBoard(boardName: string): void {
    this.selectedJobBoard.set(boardName);
    if (boardName !== 'All Matches') {
      this.searchRole.set(boardName);
      this.activeTab.set('discover');
      this.searchJobs();
    } else {
      this.searchRole.set('');
      this.activeTab.set('recommendations');
    }
  }

  getStudentName(): string {
    const prof = this.profile();
    if (prof && prof.firstName) {
      return prof.firstName;
    }
    // Fallback to email username
    const email = this.authService.currentUser()?.email || '';
    if (email) {
      const username = email.split('@')[0];
      return username
        .split(/[\._]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).replace(/[0-9]/g, ''))
        .filter(part => part.length > 0)
        .join(' ');
    }
    return 'Student';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  initiateApply(jobId: string, jobTitle: string, companyName: string, event: Event): void {
    event.stopPropagation();
    this.applyJobId.set(jobId);
    this.applyJobTitle.set(jobTitle);
    this.applyCompanyName.set(companyName);
    this.coverLetterText.set('');
    this.applicationSuccess.set(false);
    this.isApplyModalOpen.set(true);
  }

  closeApplyModal(): void {
    this.isApplyModalOpen.set(false);
    this.applyJobId.set('');
    this.applyJobTitle.set('');
    this.applyCompanyName.set('');
    this.coverLetterText.set('');
  }

  submitApplication(): void {
    const jobId = this.applyJobId();
    if (!jobId) return;

    this.isSubmittingApplication.set(true);
    this.applicationsService.applyToJob(jobId, this.coverLetterText()).subscribe({
      next: (res) => {
        this.isSubmittingApplication.set(false);
        if (res.success) {
          this.applicationSuccess.set(true);
          this.loadDashboardData();
          setTimeout(() => {
            this.closeApplyModal();
            this.closeModal(); // close details modal too
          }, 2000);
        }
      },
      error: (err) => {
        console.error('Failed to submit application', err);
        this.isSubmittingApplication.set(false);
      }
    });
  }

  getStatusStep(status: string): number {
    if (!status) return 0;
    const s = status.toUpperCase();
    switch (s) {
      case 'APPLIED':
        return 0;
      case 'VIEWED':
        return 1;
      case 'SHORTLISTED':
        return 2;
      case 'INTERVIEW':
        return 3;
      case 'OFFER':
      case 'ACCEPTED':
        return 4;
      case 'REJECTED':
        return -1;
      default:
        return 0;
    }
  }

  setApplicationsFilter(filter: string): void {
    this.applicationsFilter.set(filter);
  }

  // Upload & Review Modal Handlers
  openUploadModal(): void {
    this.uploadStep.set('select');
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.extractedData.set(null);
    this.isUploadModalOpen.set(true);
  }

  closeUploadModal(): void {
    this.isUploadModalOpen.set(false);
  }

  onModalFileSelected(event: any): void {
    const file = event.target.files?.[0] || event.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext || '')) {
      this.uploadError.set('Please upload a valid PDF or Word Document (.docx, .doc)');
      return;
    }

    this.startModalUpload(file);
  }

  private startModalUpload(file: File): void {
    this.uploadError.set(null);
    this.uploadStep.set('uploading');
    this.uploadProgress.set(10);

    const progressTimer = setInterval(() => {
      if (this.uploadProgress() < 85) {
        this.uploadProgress.update(p => Math.min(p + 5, 85));
      } else {
        clearInterval(progressTimer);
      }
    }, 500);

    this.profileService.uploadResume(file).subscribe({
      next: (res) => {
        clearInterval(progressTimer);
        this.uploadProgress.set(90);
        if (res.data && res.data.id) {
          this.currentResumeId.set(res.data.id);
        }
        // Start polling for AI extraction completion (backend takes 10-30s)
        this.startModalPolling();
      },
      error: (err) => {
        clearInterval(progressTimer);
        this.uploadStep.set('select');
        this.uploadError.set(err.error?.message || 'Failed to upload resume. Please try again.');
      }
    });
  }

  private startModalPolling(): void {
    this.stopModalPolling();
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max (60 * 3s)

    this.modalPollIntervalId = setInterval(() => {
      attempts++;

      if (attempts > maxAttempts) {
        this.stopModalPolling();
        // Timed out — move to review anyway so user is not stuck
        this.uploadProgress.set(100);
        this.extractedData.set({});
        this.uploadStep.set('review');
        this.uploadError.set('AI processing timed out. You can still confirm and search jobs.');
        return;
      }

      this.profileService.getLatestResume().subscribe({
        next: (res) => {
          if (res.success && res.data && res.data.extractedJson) {
            this.stopModalPolling();
            const rawJson = res.data.extractedJson;
            let parsed: any = null;
            try {
              parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            } catch (e) {
              console.error('JSON parse error', e);
            }
            this.extractedData.set(parsed || {});
            this.reviewRole = parsed?.preferredRole || parsed?.name || 'Software Engineer';
            this.reviewCity = parsed?.location || 'Bengaluru';
            this.reviewExperience = parsed?.experienceLevel || 'Entry-Mid';
            this.reviewWorkMode = parsed?.workMode || 'HYBRID';
            this.uploadProgress.set(100);
            this.uploadStep.set('review');
          }
          // else: still PROCESSING — keep polling
        },
        error: () => {
          // Network error during poll — just keep trying
          console.warn('Resume status poll failed, retrying...');
        }
      });
    }, 3000);
  }

  private stopModalPolling(): void {
    if (this.modalPollIntervalId) {
      clearInterval(this.modalPollIntervalId);
      this.modalPollIntervalId = null;
    }
  }

  confirmModalAndSearchJobs(): void {
    const resumeId = this.currentResumeId();
    if (resumeId) {
      this.profileService.confirmResume(resumeId).subscribe({
        next: () => {
          this.onConfirmSuccess();
        },
        error: () => {
          this.onConfirmSuccess();
        }
      });
    } else {
      this.onConfirmSuccess();
    }
  }

  private onConfirmSuccess(): void {
    this.closeUploadModal();
    this.activeTab.set('recommendations');
    this.triggerMatchGeneration();
  }

  respondToInterview(applicationId: string, response: string): void {
    const note = prompt('Enter a short note or message for the recruiter (optional):') || '';
    this.applicationsService.respondToInterview(applicationId, response, note).subscribe({
      next: (res) => {
        if (res.success) {
          alert('Interview response submitted successfully!');
          this.loadDashboardData();
        }
      },
      error: (err) => {
        console.error('Failed to submit interview response', err);
        alert('Failed to submit interview response.');
      }
    });
  }
}
