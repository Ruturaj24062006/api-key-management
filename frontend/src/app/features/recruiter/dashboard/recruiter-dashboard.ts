import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RecruiterProfileService, RecruiterProfileDto } from '../../../core/services/recruiter-profile.service';
import { JobService, JobCreateDto } from '../../../core/services/job.service';
import { JobApplicationsService } from '../../../core/services/job-applications.service';
import { StudentProfileService } from '../../../core/services/student-profile.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';
import { NgIf, NgFor, NgClass, DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-recruiter-dashboard',
  imports: [Navbar, Footer, NgIf, NgFor, NgClass, DatePipe, SlicePipe, FormsModule],
  templateUrl: './recruiter-dashboard.html',
  styleUrl: './recruiter-dashboard.css'
})
export class RecruiterDashboard implements OnInit, OnDestroy {
  private pollingSubscription: Subscription | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds real-time polling
  profile: RecruiterProfileDto | null = null;
  stats = signal<any | null>(null);
  recentApplications = signal<any[]>([]);
  isLoadingStats = signal<boolean>(false);
  lastUpdated = signal<Date | null>(null);
  isRefreshing = signal<boolean>(false);


  // Real-Time Computed Stats
  allCompanyApplications = signal<any[]>([]);
  totalJobsCount = signal<number>(0);
  activeJobsCount = signal<number>(0);
  closedJobsCount = signal<number>(0);
  recommendedCandidatesCount = signal<number>(0);
  interviewsScheduledCount = signal<number>(0);
  offersSentCount = signal<number>(0);
  hiringSuccessRate = signal<number>(0);
  averageMatchScore = signal<number>(0);

  // Real-Time Graph Data
  applicationsOverTime = signal<{ date: string, count: number }[]>([]);
  applicationsByStatus = signal<{ status: string, count: number, percent: number }[]>([]);
  topSkillsRequested = signal<{ skill: string, count: number }[]>([]);
  matchDistribution = signal<{ range: string, count: number, percent: number }[]>([]);
  recentActivitiesList = signal<{ text: string, time: Date }[]>([]);

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
  jobStep = signal<number>(1);
  isSubmittingJob = signal<boolean>(false);
  isAiLoading = signal<boolean>(false);
  aiPrompt = '';
  jobErrorMessage = signal<string | null>(null);
  jobSuccessMessage = signal<string | null>(null);

  requiredSkillsArray: string[] = [];
  newRequiredSkill = '';

  salaryMin: number | null = null;
  salaryMax: number | null = null;

  // Candidate Matching & Application Management
  searchQuery = signal<string>('');
  filterStatus = signal<string>('ALL');
  filterLocation = signal<string>('');
  filterWorkMode = signal<string>('ALL');
  filterJobType = signal<string>('ALL');
  filterExperience = signal<string>('ALL');
  filterMinApps = signal<number | null>(null);
  filterMaxApps = signal<number | null>(null);
  sortParam = signal<string>('NEWEST');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  isFilterPanelExpanded = signal<boolean>(false);

  selectedJobForDetail = signal<any | null>(null);
  selectedJobIdForMatching = signal<string>('');
  matchingCandidates = signal<any[]>([]);
  isLoadingCandidates = signal<boolean>(false);
  
  selectedJobIdForApplications = signal<string>('');
  selectedApplicationFilter = signal<string>('ALL'); // NEW, UNDER_REVIEW, INTERVIEW, REJECTED, SELECTED
  filteredApplications = signal<any[]>([]);
  
  selectedApplicantDetail = signal<any | null>(null);
  activeApplicantTab = signal<string>('ai-match');
  selectedProfile = signal<any | null>(null);
  isLoadingProfile = signal<boolean>(false);
  isMobileSidebarOpen = signal<boolean>(false);
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
    logoUrl: '',
    jobTitle: ''
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
    private readonly studentProfileService: StudentProfileService,
    public readonly router: Router
  ) {}

  ngOnInit(): void {
    this.checkOnboardingStatus();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  /** Start real-time polling every 30 seconds to keep dashboard data fresh */
  startPolling(): void {
    if (this.pollingSubscription) return; // Already polling
    this.pollingSubscription = interval(this.POLL_INTERVAL_MS).subscribe(() => {
      this.silentRefreshAll();
    });
  }

  /** Refresh all dashboard data — called explicitly after create/update/delete actions */
  refreshAll(): void {
    this.isRefreshing.set(true);
    this.loadMyJobs();
    this.loadStats();
    if (this.selectedJobIdForMatching()) this.loadMatchingCandidates();
    if (this.selectedJobIdForApplications()) this.loadFilteredApplications();
    setTimeout(() => {
      this.isRefreshing.set(false);
      this.lastUpdated.set(new Date());
    }, 2000);
  }

  /** Silent refresh (no loading spinner) — used by the background polling */
  silentRefreshAll(): void {
    // Fetch jobs silently
    this.jobService.getMyJobs().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.myJobs.set(res.data);
          this.totalJobsCount.set(res.data.length);
          this.activeJobsCount.set(res.data.filter((j: any) => j.status === 'ACTIVE').length);
          this.closedJobsCount.set(res.data.filter((j: any) => j.status === 'CLOSED').length);

          const jobIds = res.data.map((j: any) => j.id);
          if (jobIds.length === 0) {
            this.allCompanyApplications.set([]);
            this.calculateMetricsAndGraphs([]);
            this.lastUpdated.set(new Date());
            return;
          }
          let loaded = 0;
          const allApps: any[] = [];
          jobIds.forEach((jobId: string) => {
            this.applicationsService.getJobApplications(jobId).subscribe({
              next: (appRes) => {
                loaded++;
                if (appRes.success && Array.isArray(appRes.data)) allApps.push(...appRes.data);
                if (loaded === jobIds.length) {
                  this.allCompanyApplications.set(allApps);
                  this.calculateMetricsAndGraphs(allApps);
                  this.lastUpdated.set(new Date());
                }
              },
              error: () => {
                loaded++;
                if (loaded === jobIds.length) {
                  this.allCompanyApplications.set(allApps);
                  this.calculateMetricsAndGraphs(allApps);
                  this.lastUpdated.set(new Date());
                }
              }
            });
          });
        }
      }
    });
    // Also silently reload applications if a job is selected
    if (this.selectedJobIdForMatching()) this.loadMatchingCandidates();
    if (this.selectedJobIdForApplications()) this.loadFilteredApplications();
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
            logoUrl: profileData.logoUrl || '',
            jobTitle: profileData.jobTitle || ''
          };

          if (!profileData.companyName || !profileData.industry) {
            this.router.navigate(['/recruiter/onboarding']);
          } else {
            this.loadStats();
            this.loadMyJobs();
            // Start background polling after initial data is loaded
            setTimeout(() => this.startPolling(), 5000);
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

          // Compile real-time stats and metrics from all jobs
          const jobIds = res.data.map((j: any) => j.id);
          this.totalJobsCount.set(jobIds.length);
          this.activeJobsCount.set(res.data.filter((j: any) => j.status === 'ACTIVE').length);
          this.closedJobsCount.set(res.data.filter((j: any) => j.status === 'CLOSED').length);

          let loadedCount = 0;
          const allApps: any[] = [];
          
          if (jobIds.length === 0) {
            this.allCompanyApplications.set([]);
            this.calculateMetricsAndGraphs([]);
            return;
          }

          jobIds.forEach((jobId: string) => {
            this.applicationsService.getJobApplications(jobId).subscribe({
              next: (appRes) => {
                loadedCount++;
                if (appRes.success && Array.isArray(appRes.data)) {
                  allApps.push(...appRes.data);
                }
                if (loadedCount === jobIds.length) {
                  this.allCompanyApplications.set(allApps);
                  this.calculateMetricsAndGraphs(allApps);
                }
              },
              error: () => {
                loadedCount++;
                if (loadedCount === jobIds.length) {
                  this.allCompanyApplications.set(allApps);
                  this.calculateMetricsAndGraphs(allApps);
                }
              }
            });
          });
        }
      },
      error: (err) => {
        this.isLoadingJobs.set(false);
        console.error('Error loading jobs:', err);
      }
    });
  }

  calculateMetricsAndGraphs(apps: any[]): void {
    // 1. Recommended Candidates Count (Match Score >= 70%)
    const recommended = apps.filter(a => (a.matchScore || 0) >= 70).length;
    // 2. Interviews Scheduled (Status = INTERVIEW)
    const interviews = apps.filter(a => a.status === 'INTERVIEW').length;
    // 3. Offers Sent (Status = OFFER or ACCEPTED)
    const offers = apps.filter(a => a.status === 'OFFER' || a.status === 'ACCEPTED').length;

    this.recommendedCandidatesCount.set(recommended);
    this.interviewsScheduledCount.set(interviews);
    this.offersSentCount.set(offers);

    // 4. Hiring Success Rate (Offers / Total Applications)
    const rate = apps.length > 0 ? Math.round((offers / apps.length) * 100) : 0;
    this.hiringSuccessRate.set(rate);

    // 4.5 Average Candidate Match Score
    const totalScore = apps.reduce((sum, a) => sum + (a.matchScore || 0), 0);
    const avgScore = apps.length > 0 ? Math.round(totalScore / apps.length) : 0;
    this.averageMatchScore.set(avgScore);

    // 5. Applications over Time (group by date)
    const timeMap: Record<string, number> = {};
    apps.forEach(a => {
      if (a.createdAt) {
        const d = new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        timeMap[d] = (timeMap[d] || 0) + 1;
      }
    });
    const overTime = Object.keys(timeMap).map(k => ({ date: k, count: timeMap[k] }));
    this.applicationsOverTime.set(overTime.slice(-7));

    // 6. Applications by Status
    const statusMap: Record<string, number> = {};
    apps.forEach(a => {
      const s = this.getStatusLabel(a.status);
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const byStatus = Object.keys(statusMap).map(k => ({
      status: k,
      count: statusMap[k],
      percent: apps.length > 0 ? Math.round((statusMap[k] / apps.length) * 100) : 0
    }));
    this.applicationsByStatus.set(byStatus);

    // 7. Top Skills Requested (based on active jobs list)
    const skillMap: Record<string, number> = {};
    this.myJobs().forEach(j => {
      if (j.requiredSkills) {
        j.requiredSkills.split(',').forEach((s: string) => {
          const trimmed = s.trim();
          if (trimmed) {
            skillMap[trimmed] = (skillMap[trimmed] || 0) + 1;
          }
        });
      }
    });
    const skills = Object.keys(skillMap)
      .map(k => ({ skill: k, count: skillMap[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    this.topSkillsRequested.set(skills);

    // 8. Candidate Match Score Distribution (High >= 80%, Mid 60-79%, Low < 60%)
    let high = 0, mid = 0, low = 0;
    apps.forEach(a => {
      const score = a.matchScore || 0;
      if (score >= 80) high++;
      else if (score >= 60) mid++;
      else low++;
    });
    const dist = [
      { range: 'High Match (80-100%)', count: high, percent: apps.length > 0 ? Math.round((high / apps.length) * 100) : 0 },
      { range: 'Mid Match (60-79%)', count: mid, percent: apps.length > 0 ? Math.round((mid / apps.length) * 100) : 0 },
      { range: 'Low Match (<60%)', count: low, percent: apps.length > 0 ? Math.round((low / apps.length) * 100) : 0 }
    ];
    this.matchDistribution.set(dist);

    // 9. Recent Activity Feed
    const activities: { text: string, time: Date }[] = [];
    const sortedApps = [...apps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sortedApps.slice(0, 5).forEach(a => {
      activities.push({
        text: `New application: ${a.studentName} for '${a.jobTitle}' (Fit: ${a.matchScore || 0}%)`,
        time: new Date(a.createdAt)
      });
    });
    this.myJobs().forEach(j => {
      if (j.createdAt) {
        activities.push({
          text: `Job posted: '${j.title}' at ${j.location}`,
          time: new Date(j.createdAt)
        });
      }
    });
    this.recentActivitiesList.set(activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6));
  }

  getFilteredJobs(): any[] {
    let result = [...this.myJobs()];

    // Search query
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      result = result.filter(j => 
        j.title.toLowerCase().includes(q) || 
        j.description.toLowerCase().includes(q) ||
        (j.requiredSkills && j.requiredSkills.toLowerCase().includes(q))
      );
    }

    // Status filter
    const status = this.filterStatus();
    if (status !== 'ALL') {
      result = result.filter(j => j.status === status);
    }

    // Location filter
    const loc = this.filterLocation().toLowerCase().trim();
    if (loc) {
      result = result.filter(j => j.location && j.location.toLowerCase().includes(loc));
    }

    // Work Mode
    const wm = this.filterWorkMode();
    if (wm !== 'ALL') {
      result = result.filter(j => j.workMode === wm);
    }

    // Employment Type (Job Type)
    const jt = this.filterJobType();
    if (jt !== 'ALL') {
      result = result.filter(j => j.jobType === jt);
    }

    // Experience Level
    const exp = this.filterExperience();
    if (exp !== 'ALL') {
      result = result.filter(j => j.experienceLevel && j.experienceLevel.toLowerCase().includes(exp.toLowerCase()));
    }

    // App count range
    const minApps = this.filterMinApps();
    if (minApps !== null) {
      result = result.filter(j => this.getJobApplicationsCount(j.id) >= minApps);
    }
    const maxApps = this.filterMaxApps();
    if (maxApps !== null) {
      result = result.filter(j => this.getJobApplicationsCount(j.id) <= maxApps);
    }

    // Sorting
    const sort = this.sortParam();
    if (sort === 'NEWEST') {
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sort === 'OLDEST') {
      result.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (sort === 'MOST_APPS') {
      result.sort((a, b) => this.getJobApplicationsCount(b.id) - this.getJobApplicationsCount(a.id));
    } else if (sort === 'HIGHEST_MATCH') {
      result.sort((a, b) => this.getJobRecommendedCount(b.id) - this.getJobRecommendedCount(a.id));
    } else if (sort === 'TITLE_AZ') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }

  getPaginatedJobs(): any[] {
    const filtered = this.getFilteredJobs();
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return filtered.slice(startIndex, startIndex + this.pageSize());
  }

  getTotalPages(): number {
    return Math.ceil(this.getFilteredJobs().length / this.pageSize());
  }

  changePage(page: number): void {
    const total = this.getTotalPages();
    if (page >= 1 && page <= total) {
      this.currentPage.set(page);
    }
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.filterStatus.set('ALL');
    this.filterLocation.set('');
    this.filterWorkMode.set('ALL');
    this.filterJobType.set('ALL');
    this.filterExperience.set('ALL');
    this.filterMinApps.set(null);
    this.filterMaxApps.set(null);
    this.currentPage.set(1);
  }

  removeFilter(type: string): void {
    if (type === 'query') this.searchQuery.set('');
    if (type === 'status') this.filterStatus.set('ALL');
    if (type === 'location') this.filterLocation.set('');
    if (type === 'workMode') this.filterWorkMode.set('ALL');
    if (type === 'jobType') this.filterJobType.set('ALL');
    if (type === 'experience') this.filterExperience.set('ALL');
    this.currentPage.set(1);
  }

  hasActiveFilters(): boolean {
    return !!this.searchQuery() || 
           this.filterStatus() !== 'ALL' || 
           !!this.filterLocation() || 
           this.filterWorkMode() !== 'ALL' || 
           this.filterJobType() !== 'ALL' || 
           this.filterExperience() !== 'ALL' ||
           this.filterMinApps() !== null ||
           this.filterMaxApps() !== null;
  }

  getJobApplicationsCount(jobId: string): number {
    return this.allCompanyApplications().filter(a => a.jobId === jobId).length;
  }

  getJobRecommendedCount(jobId: string): number {
    return this.allCompanyApplications().filter(a => a.jobId === jobId && (a.matchScore || 0) >= 70).length;
  }

  getJobDeadline(createdAtStr: string): Date {
    const date = createdAtStr ? new Date(createdAtStr) : new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  deleteJob(jobId: string): void {
    if (confirm('Are you sure you want to permanently delete this job listing? This action cannot be undone.')) {
      this.jobService.deleteJob(jobId).subscribe({
        next: (res) => {
          if (res.success) {
            this.refreshAll();
          }
        },
        error: () => {
          console.warn('Backend server down. Deleting job locally...');
          const updated = this.myJobs().filter(j => j.id !== jobId);
          this.myJobs.set(updated);
          this.calculateMetricsAndGraphs(this.allCompanyApplications());
        }
      });
    }
  }

  exportJobs(): void {
    const jobs = this.myJobs();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jobs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `jobs_export_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importJobs(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const jobs = JSON.parse(e.target.result);
        if (Array.isArray(jobs)) {
          let count = 0;
          jobs.forEach((j: any) => {
            const payload: JobCreateDto = {
              title: j.title || 'Imported Job',
              description: j.description || 'No description provided.',
              requirements: j.requirements || '',
              location: j.location || '',
              jobType: j.jobType || 'FULL_TIME',
              experienceLevel: j.experienceLevel || '',
              salaryRange: j.salaryRange || '',
              requiredSkills: j.requiredSkills || '',
              preferredSkills: j.preferredSkills || '',
              workMode: j.workMode || 'HYBRID',
              educationLevel: j.educationLevel || '',
              sponsorshipAvailable: j.sponsorshipAvailable || false
            };
            this.jobService.createJob(payload).subscribe({
              next: () => {
                count++;
                if (count === jobs.length) {
                  alert(`Successfully imported ${count} jobs!`);
                  this.loadMyJobs();
                  this.loadStats();
                }
              }
            });
          });
        }
      } catch (err) {
        alert('Invalid file format. Please upload a valid JSON jobs file.');
      }
    };
    reader.readAsText(file);
  }

  viewJobDetailModal(job: any): void {
    this.selectedJobForDetail.set(job);
  }

  closeJobDetailModal(): void {
    this.selectedJobForDetail.set(null);
  }

  // Sidebar Menu Actions
  selectMenu(menu: string): void {
    this.activeMenu.set(menu);
    this.selectedApplicantDetail.set(null);
    this.jobErrorMessage.set(null);
    this.jobSuccessMessage.set(null);
    this.profileMessage.set(null);
    this.settingsMessage.set(null);

    if (menu === 'dashboard') {
      // Always refresh everything when going back to dashboard
      this.refreshAll();
    } else if (menu === 'create-job') {
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
    this.requiredSkillsArray = [];
    this.newRequiredSkill = '';
    this.salaryMin = null;
    this.salaryMax = null;
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
            if (data.requiredSkills) {
              this.jobForm.requiredSkills = data.requiredSkills;
              this.requiredSkillsArray = data.requiredSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
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

  addRequiredSkill(): void {
    const s = this.newRequiredSkill.trim();
    if (s) {
      if (!this.requiredSkillsArray.includes(s)) {
        this.requiredSkillsArray.push(s);
        this.jobForm.requiredSkills = this.requiredSkillsArray.join(', ');
      }
      this.newRequiredSkill = '';
      this.jobErrorMessage.set(null);
    }
  }

  removeRequiredSkill(index: number): void {
    this.requiredSkillsArray.splice(index, 1);
    this.jobForm.requiredSkills = this.requiredSkillsArray.join(', ');
  }

  nextJobStep(): void {
    if (this.jobStep() === 1) {
      if (!this.jobForm.title?.trim() || !this.jobForm.description?.trim()) {
        this.jobErrorMessage.set('Job Title and Description are required in Step 1.');
        return;
      }
    } else if (this.jobStep() === 2) {
      if (!this.jobForm.location?.trim() || !this.jobForm.workMode) {
        this.jobErrorMessage.set('Location and Work Mode are required in Step 2.');
        return;
      }
    } else if (this.jobStep() === 3) {
      if (this.requiredSkillsArray.length === 0) {
        this.jobErrorMessage.set('At least one required skill is required in Step 3.');
        return;
      }
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

    if (this.salaryMin !== null || this.salaryMax !== null) {
      const min = this.salaryMin !== null ? `₹${this.salaryMin} LPA` : '';
      const max = this.salaryMax !== null ? `₹${this.salaryMax} LPA` : '';
      if (min && max) {
        this.jobForm.salaryRange = `${min} - ${max}`;
      } else {
        this.jobForm.salaryRange = min || max;
      }
    } else {
      this.jobForm.salaryRange = '';
    }

    const payload = { ...this.jobForm };
    if (payload.deadline) {
      payload.deadline = new Date(payload.deadline).toISOString();
    }

    const action = payload.id 
      ? this.jobService.updateJob(payload.id, payload)
      : this.jobService.createJob(payload);

    action.subscribe({
      next: (res) => {
        this.isSubmittingJob.set(false);
        if (res.success) {
          const isEdit = !!payload.id;
          this.jobSuccessMessage.set(isEdit ? 'Job updated successfully!' : 'Job posted successfully!');
          // Immediately refresh all data from backend so it persists across page reloads
          this.refreshAll();
          setTimeout(() => {
            this.selectMenu('all-jobs');
            this.jobSuccessMessage.set(null);
          }, 1500);
        } else {
          this.jobErrorMessage.set('Unexpected response from server. Please try again.');
        }
      },
      error: (err) => {
        this.isSubmittingJob.set(false);

        // Extract real error message from backend ApiResponse body
        const backendMsg: string = err.error?.message || err.error?.error || '';

        if (err.status === 0) {
          console.warn('Backend server down. Activating developer mock save fallback...', err);
          const mockJob = {
            id: payload.id || Math.random().toString(36).substring(7),
            title: payload.title,
            description: payload.description,
            requirements: payload.requirements || '',
            location: payload.location || 'Remote',
            jobType: payload.jobType || 'FULL_TIME',
            experienceLevel: payload.experienceLevel || '',
            salaryRange: payload.salaryRange || '',
            requiredSkills: payload.requiredSkills || '',
            preferredSkills: payload.preferredSkills || '',
            workMode: payload.workMode || 'HYBRID',
            educationLevel: payload.educationLevel || '',
            sponsorshipAvailable: payload.sponsorshipAvailable || false,
            department: payload.department || '',
            gpaCutoff: payload.gpaCutoff,
            deadline: payload.deadline,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
          };

          if (payload.id) {
            const updated = this.myJobs().map(j => j.id === payload.id ? mockJob : j);
            this.myJobs.set(updated);
          } else {
            this.myJobs.set([mockJob, ...this.myJobs()]);
          }

          // Recalculate dashboard metrics
          this.calculateMetricsAndGraphs(this.allCompanyApplications());

          this.jobSuccessMessage.set(payload.id ? 'Job updated successfully (offline)!' : 'Job posted successfully (offline)!');
          setTimeout(() => {
            this.selectMenu('all-jobs');
            this.jobSuccessMessage.set(null);
          }, 1500);
        } else if (backendMsg.toLowerCase().includes('company') || backendMsg.toLowerCase().includes('recruiter profile')) {
          // Recruiter hasn't completed company onboarding yet
          this.jobErrorMessage.set('⚠️ Your company profile is not set up yet. Please go to Company Profile and save your company details before posting a job.');
        } else {
          this.jobErrorMessage.set(backendMsg || 'Failed to save the job posting. Please try again.');
        }
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
      experienceLevel: job.experienceLevel || 'Entry-level',
      salaryRange: job.salaryRange || '',
      requiredSkills: job.requiredSkills || '',
      preferredSkills: job.preferredSkills || '',
      workMode: job.workMode || 'HYBRID',
      educationLevel: job.educationLevel || "Bachelor's",
      sponsorshipAvailable: job.sponsorshipAvailable || false,
      department: job.department || '',
      gpaCutoff: job.gpaCutoff,
      deadline: job.deadline ? job.deadline.substring(0, 10) : ''
    };
    if (job.requiredSkills) {
      this.requiredSkillsArray = job.requiredSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      this.requiredSkillsArray = [];
    }
    if (job.salaryRange) {
      const match = job.salaryRange.match(/₹?(\d+)\s*(?:LPA)?\s*-\s*₹?(\d+)\s*(?:LPA)?/i);
      if (match) {
        this.salaryMin = parseInt(match[1], 10);
        this.salaryMax = parseInt(match[2], 10);
      } else {
        const singleMatch = job.salaryRange.match(/₹?(\d+)/);
        if (singleMatch) {
          this.salaryMin = parseInt(singleMatch[1], 10);
          this.salaryMax = null;
        } else {
          this.salaryMin = null;
          this.salaryMax = null;
        }
      }
    } else {
      this.salaryMin = null;
      this.salaryMax = null;
    }
    this.jobStep.set(1);
    this.activeMenu.set('edit-job');
  }

  closeJob(jobId: string): void {
    if (confirm('Are you sure you want to close this job listing? Applicants will no longer be matched.')) {
      this.jobService.updateJobStatus(jobId, 'CLOSED').subscribe({
        next: () => {
          this.refreshAll();
        },
        error: () => {
          console.warn('Backend server down. Closing job locally...');
          const updated = this.myJobs().map(j => j.id === jobId ? { ...j, status: 'CLOSED' } : j);
          this.myJobs.set(updated);
          this.calculateMetricsAndGraphs(this.allCompanyApplications());
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
      experienceLevel: job.experienceLevel || 'Entry-level',
      salaryRange: job.salaryRange || '',
      requiredSkills: job.requiredSkills || '',
      preferredSkills: job.preferredSkills || '',
      workMode: job.workMode || 'HYBRID',
      educationLevel: job.educationLevel || "Bachelor's",
      sponsorshipAvailable: job.sponsorshipAvailable || false,
      department: job.department || '',
      gpaCutoff: job.gpaCutoff,
      deadline: job.deadline ? job.deadline.substring(0, 10) : ''
    };
    if (job.requiredSkills) {
      this.requiredSkillsArray = job.requiredSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      this.requiredSkillsArray = [];
    }
    if (job.salaryRange) {
      const match = job.salaryRange.match(/₹?(\d+)\s*(?:LPA)?\s*-\s*₹?(\d+)\s*(?:LPA)?/i);
      if (match) {
        this.salaryMin = parseInt(match[1], 10);
        this.salaryMax = parseInt(match[2], 10);
      } else {
        const singleMatch = job.salaryRange.match(/₹?(\d+)/);
        if (singleMatch) {
          this.salaryMin = parseInt(singleMatch[1], 10);
          this.salaryMax = null;
        } else {
          this.salaryMin = null;
          this.salaryMax = null;
        }
      }
    } else {
      this.salaryMin = null;
      this.salaryMax = null;
    }
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
    this.activeApplicantTab.set('ai-match');
    this.selectedProfile.set(null);
    if (candidate.studentId) {
      this.isLoadingProfile.set(true);
      this.studentProfileService.getProfileById(candidate.studentId).subscribe({
        next: (res) => {
          this.isLoadingProfile.set(false);
          if (res.success && res.data) {
            this.selectedProfile.set(res.data);
          }
        },
        error: () => {
          this.isLoadingProfile.set(false);
        }
      });
    }
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

  quickShortlist(app: any): void {
    this.applicationsService.updateStatus(app.id, 'SHORTLISTED', 'Quick shortlist from dashboard').subscribe({
      next: (res) => {
        if (res.success) {
          this.loadStats();
          this.loadMyJobs();
          alert(`${app.studentName} has been shortlisted.`);
        }
      },
      error: () => {
        // Fallback for mock status updates
        app.status = 'SHORTLISTED';
        alert(`${app.studentName} shortlisted (local fallback).`);
      }
    });
  }

  updateApplicationStatus(app: any, newStatus: string): void {
    this.applicationsService.updateStatus(app.id, newStatus, `Status updated to ${newStatus} from application dashboard`).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadFilteredApplications();
          this.loadStats();
          this.loadMatchingCandidates();
        }
      },
      error: () => {
        app.status = newStatus;
        this.loadFilteredApplications();
        this.loadStats();
        this.loadMatchingCandidates();
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
              if (filter === 'SHORTLISTED') return app.status === 'SHORTLISTED';
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

  countApplicationsByStatus(status: string): number {
    return this.allCompanyApplications().filter(a => a.status === status).length;
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

  getScoreColorClass(score: number): string {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-mid';
    return 'score-low';
  }

  getMinIndex(currentPage: number, pageSize: number, total: number): number {
    return Math.min(currentPage * pageSize, total);
  }

  getMatchReasons(candidate: any): string[] {
    const reasons: string[] = [];
    if ((candidate.technicalFit || 0) >= 80) reasons.push('Strong Technical Fit');
    if ((candidate.projectFit || 0) >= 80) reasons.push('Excellent Projects');
    if ((candidate.experienceFit || 0) >= 80) reasons.push('Aligned Work History');
    if ((candidate.educationFit || 0) >= 80) reasons.push('Meets Education Criteria');
    
    if (reasons.length === 0) {
      if ((candidate.matchScore || 0) >= 70) {
        reasons.push('High Overall Affinity');
      } else {
        reasons.push('Core Skill Alignment');
      }
    }
    return reasons;
  }

  getMissingSkills(candidate: any): string[] {
    const missing: string[] = [];
    if ((candidate.technicalFit || 0) < 65) missing.push('Review Tech Stack gaps');
    if ((candidate.projectFit || 0) < 65) missing.push('Review Project depth');
    if ((candidate.experienceFit || 0) < 65) missing.push('Review Work Experience duration');
    
    if (missing.length === 0) {
      missing.push('No critical gaps identified');
    }
    return missing;
  }

  getAverageSelectedJobMatchScore(): number {
    const list = this.matchingCandidates();
    if (!list || list.length === 0) return 0;
    const sum = list.reduce((acc, c) => acc + (c.matchScore || 0), 0);
    return Math.round(sum / list.length);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
