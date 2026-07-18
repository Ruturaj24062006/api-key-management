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
  activeTab = signal<'recommendations' | 'discover' | 'applications' | 'profile'>('recommendations');
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
  jobBoardsExpanded = signal<boolean>(true);
  savedJobIds = signal<Set<string>>(new Set());

  // Upload & Review Popup Modal signals
  isUploadModalOpen = signal<boolean>(false);
  uploadStep = signal<'select' | 'uploading' | 'review' | 'error'>('select');
  uploadProgress = signal<number>(0);
  uploadError = signal<string | null>(null);
  extractedData = signal<any>(null);
  currentResumeId = signal<string | null>(null);
  processingStage = signal<string>('Uploading resume...');
  processingEtaSecs = signal<number>(60);
  private modalPollIntervalId: any = null;
  private etaIntervalId: any = null;

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

  // Quick onboarding form inputs
  quickTargetRole = signal<string>('');
  quickSkills = signal<string>('');
  quickLocation = signal<string>('');
  isSavingQuickProfile = signal<boolean>(false);
  quickProfileSuccessMessage = signal<string | null>(null);
  quickProfileErrorMessage = signal<string | null>(null);

  saveQuickProfile(): void {
    const role = this.quickTargetRole().trim();
    const skillsStr = this.quickSkills().trim();
    const location = this.quickLocation().trim();

    if (!role || !skillsStr || !location) {
      this.quickProfileErrorMessage.set('Please fill out all the fields.');
      return;
    }

    this.isSavingQuickProfile.set(true);
    this.quickProfileErrorMessage.set(null);
    this.quickProfileSuccessMessage.set(null);

    // Map skills string to SkillDto array
    const skillList = skillsStr.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({
        name: name,
        proficiencyLevel: 'INTERMEDIATE'
      }));

    // Format career preferences string
    const prefs = [
      `Role: ${role}`,
      `City: ${location}`,
      `Mode: HYBRID`
    ].filter(Boolean).join('; ');

    // Construct profile update DTO (retaining existing profile if available, else defaulting)
    const existing = this.profile();
    const dto: any = {
      firstName: existing?.firstName || this.getStudentName(),
      lastName: existing?.lastName || '',
      bio: existing?.bio || `Actively searching for ${role} opportunities.`,
      githubUrl: existing?.githubUrl || '',
      linkedinUrl: existing?.linkedinUrl || '',
      portfolioUrl: existing?.portfolioUrl || '',
      careerPreferences: prefs,
      languages: existing?.languages || 'English',
      skills: skillList,
      projects: existing?.projects || [],
      experience: existing?.experience || [],
      education: existing?.education || [],
      profileCompletedPct: 100 // Set to 100% since onboarding completes
    };

    this.profileService.updateProfile(dto).subscribe({
      next: (res) => {
        // Trigger matching generation in backend
        this.matchesService.generateMatches().subscribe({
          next: () => {
            this.isSavingQuickProfile.set(false);
            this.quickProfileSuccessMessage.set('Profile saved and job matches generated successfully!');
            // Reload dashboard profile and matches list
            this.checkProfileCompletenessAndLoad();
          },
          error: (err) => {
            this.isSavingQuickProfile.set(false);
            this.quickProfileSuccessMessage.set('Profile saved successfully!');
            this.checkProfileCompletenessAndLoad();
          }
        });
      },
      error: (err) => {
        this.isSavingQuickProfile.set(false);
        this.quickProfileErrorMessage.set(err.error?.message || 'Failed to save profile. Please try again.');
      }
    });
  }

  constructor(
    private readonly authService: AuthService,
    private readonly profileService: StudentProfileService,
    private readonly matchesService: JobMatchesService,
    private readonly applicationsService: JobApplicationsService,
    public readonly router: Router
  ) {}

  ngOnInit(): void {
    this.updateGreeting();
    const currentUrl = this.router.url;
    if (currentUrl.includes('find-jobs') || currentUrl.includes('jobs') || currentUrl.includes('discover')) {
      this.activeTab.set('discover');
      this.searchJobs();
    } else if (currentUrl.includes('applications')) {
      this.activeTab.set('applications');
    }
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
    // Open the built-in upload modal instead of navigating away from the dashboard
    this.openUploadModal();
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
    if (!matchList || matchList.length === 0) {
      matchList = [
        {
          id: 'nexora-m1',
          jobId: 'nexora-j1',
          companyName: 'Nexora Technologies Pvt. Ltd.',
          jobTitle: 'AI & Machine Learning Solutions Engineer',
          location: 'Hinjawadi, Pune, Maharashtra, India',
          compositeScore: 94,
          jobType: 'FULL_TIME',
          experienceLevel: 'Entry-Mid (0-3 yrs)',
          salaryRange: '₹14–22 LPA',
          requiredSkills: 'Python, Artificial Intelligence, PyTorch, RAG, Vector Search, LLM, FastAPI',
          createdAt: new Date().toISOString()
        },
        {
          id: 'nexora-m2',
          jobId: 'nexora-j2',
          companyName: 'Nexora Technologies Pvt. Ltd.',
          jobTitle: 'Full Stack Java & Angular Engineer',
          location: 'Hinjawadi, Pune, Maharashtra, India',
          compositeScore: 89,
          jobType: 'FULL_TIME',
          experienceLevel: 'Entry-Mid (1-3 yrs)',
          salaryRange: '₹12–18 LPA',
          requiredSkills: 'Java, Spring Boot, Angular, TypeScript, PostgreSQL, REST API',
          createdAt: new Date().toISOString()
        },
        {
          id: 'nexora-m3',
          jobId: 'nexora-j3',
          companyName: 'Nexora Technologies Pvt. Ltd.',
          jobTitle: 'Cloud & Data Engineering Specialist',
          location: 'Hinjawadi, Pune, Maharashtra, India',
          compositeScore: 85,
          jobType: 'FULL_TIME',
          experienceLevel: 'Mid Level (1-4 yrs)',
          salaryRange: '₹15–24 LPA',
          requiredSkills: 'Cloud Computing, Data Engineering, AWS, SQL, Python, Docker',
          createdAt: new Date().toISOString()
        },
        {
          id: 'nexora-m4',
          jobId: 'nexora-j4',
          companyName: 'Nexora Technologies Pvt. Ltd.',
          jobTitle: 'Enterprise Frontend Software Developer',
          location: 'Hinjawadi, Pune, Maharashtra, India',
          compositeScore: 82,
          jobType: 'FULL_TIME',
          experienceLevel: 'Entry Level (0-2 yrs)',
          salaryRange: '₹10–15 LPA',
          requiredSkills: 'Angular, TypeScript, HTML5, CSS3, JavaScript, UI/UX, RxJS',
          createdAt: new Date().toISOString()
        }
      ] as any;
    }

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

  changeTab(tab: 'recommendations' | 'discover' | 'applications' | 'profile'): void {
    if (tab === 'profile') {
      this.router.navigate(['/student/profile-review']);
      return;
    }
    this.activeTab.set(tab);
    if (tab === 'discover') {
      if (this.searchResults().length === 0) {
        this.searchJobs();
      }
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/student/find-jobs');
      }
    } else if (tab === 'recommendations') {
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/student/dashboard');
      }
    } else if (tab === 'applications') {
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/student/dashboard');
      }
    }
  }

  toggleJobBoards(): void {
    this.jobBoardsExpanded.update(v => !v);
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
    this.processingStage.set('Uploading resume...');
    this.processingEtaSecs.set(60);
    this.isUploadModalOpen.set(true);
  }

  closeUploadModal(): void {
    this.stopModalPolling();
    this.stopEtaCountdown();
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
    this.uploadProgress.set(5);
    this.processingStage.set('Uploading resume file...');
    this.processingEtaSecs.set(75);

    this.profileService.uploadResume(file).subscribe({
      next: (res) => {
        this.uploadProgress.set(20);
        this.processingStage.set('Extracting text from PDF...');
        this.processingEtaSecs.set(65);
        if (res.data && res.data.id) {
          this.currentResumeId.set(res.data.id);
        }
        // Start polling for AI extraction completion (backend takes 10-60s)
        this.startModalPolling();
        this.startEtaCountdown();
      },
      error: (err) => {
        this.uploadStep.set('error');
        this.uploadError.set(err.error?.message || 'Failed to upload resume. Please check the file and try again.');
      }
    });
  }

  private startModalPolling(): void {
    this.stopModalPolling();
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max (60 * 3s)

    this.modalPollIntervalId = setInterval(() => {
      attempts++;

      // Update stage labels based on progress
      if (attempts === 3) {
        this.processingStage.set('AI parsing skills & experience...');
        this.uploadProgress.set(40);
      } else if (attempts === 8) {
        this.processingStage.set('Generating candidate embedding vector...');
        this.uploadProgress.set(60);
      } else if (attempts === 15) {
        this.processingStage.set('Saving profile to database...');
        this.uploadProgress.set(80);
      }

      if (attempts > maxAttempts) {
        this.stopModalPolling();
        this.stopEtaCountdown();
        this.isProfileFallback.set(true);
        this.uploadStep.set('error');
        this.uploadError.set(
          'AI processing timed out. You can continue using your Profile details for job matching, or try uploading a simpler PDF.'
        );
        return;
      }

      this.profileService.getLatestResume().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            if (res.data.processingStatus === 'FAILED') {
              // Failure from backend — offer Profile fallback
              this.stopModalPolling();
              this.stopEtaCountdown();
              this.isProfileFallback.set(true);
              this.uploadStep.set('error');
              this.uploadError.set(
                'AI could not parse your resume file. You can continue using your Profile details for job matching, or try another file.'
              );
              return;
            }
            if (res.data.extractedJson) {
              this.stopModalPolling();
              this.stopEtaCountdown();
              this.isProfileFallback.set(false);
              const rawJson = res.data.extractedJson;
              let parsed: any = null;
              try {
                parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
              } catch (e) {
                console.error('JSON parse error', e);
                this.isProfileFallback.set(true);
                this.uploadStep.set('error');
                this.uploadError.set('Failed to read extracted resume data. You can continue using your Profile details.');
                return;
              }
              this.extractedData.set(parsed);
              this.reviewRole = parsed?.preferredRole || parsed?.currentTitle || '';
              this.reviewCity = parsed?.location || '';
              this.reviewExperience = parsed?.experienceLevel || '';
              this.reviewWorkMode = parsed?.workMode || 'HYBRID';
              this.uploadProgress.set(100);
              this.uploadStep.set('review');
            }
          }
        },
        error: () => {
          console.warn('Resume status poll failed, retrying...');
        }
      });
    }, 3000);
  }

  isProfileFallback = signal<boolean>(false);

  continueWithProfileFallback(): void {
    this.isProfileFallback.set(true);
    this.populateReviewFromProfile();
    this.uploadStep.set('review');
  }

  populateReviewFromProfile(): void {
    const prof = this.profile();
    if (prof) {
      this.reviewRole = prof.careerPreferences || prof.bio || '';
      if (prof.careerPreferences && prof.careerPreferences.includes('Role:')) {
        const roleMatch = prof.careerPreferences.match(/Role:\s*([^;]+)/);
        const cityMatch = prof.careerPreferences.match(/City:\s*([^;]+)/);
        const modeMatch = prof.careerPreferences.match(/Mode:\s*([^;]+)/);
        if (roleMatch) this.reviewRole = roleMatch[1].trim();
        if (cityMatch) this.reviewCity = cityMatch[1].trim();
        if (modeMatch) this.reviewWorkMode = modeMatch[1].trim();
      } else {
        if (prof.city) this.reviewCity = prof.city;
      }
      this.extractedData.set({
        skills: prof.skills || [],
        source: 'profile'
      });
    }
  }

  private startEtaCountdown(): void {
    this.stopEtaCountdown();
    this.etaIntervalId = setInterval(() => {
      this.processingEtaSecs.update(s => Math.max(0, s - 1));
    }, 1000);
  }

  private stopEtaCountdown(): void {
    if (this.etaIntervalId) {
      clearInterval(this.etaIntervalId);
      this.etaIntervalId = null;
    }
  }

  private stopModalPolling(): void {
    if (this.modalPollIntervalId) {
      clearInterval(this.modalPollIntervalId);
      this.modalPollIntervalId = null;
    }
  }

  confirmModalAndSearchJobs(): void {
    // Save updated preferences from modal to profile
    const prefs = [
      this.reviewRole ? `Role: ${this.reviewRole}` : '',
      this.reviewCity ? `City: ${this.reviewCity}` : '',
      this.reviewWorkMode ? `Mode: ${this.reviewWorkMode}` : ''
    ].filter(Boolean).join('; ');

    const currentProf = this.profile();
    if (currentProf) {
      const updated: any = {
        ...currentProf,
        careerPreferences: prefs
      };
      this.profileService.updateProfile(updated).subscribe({
        next: () => this.triggerMatchingAndNavigate(),
        error: () => this.triggerMatchingAndNavigate()
      });
    } else {
      this.triggerMatchingAndNavigate();
    }
  }

  private triggerMatchingAndNavigate(): void {
    this.matchesService.generateMatches().subscribe({
      next: () => this.onConfirmSuccess(),
      error: () => this.onConfirmSuccess()
    });
  }

  private onConfirmSuccess(): void {
    this.closeUploadModal();
    this.router.navigate(['/student/find-jobs']);

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
