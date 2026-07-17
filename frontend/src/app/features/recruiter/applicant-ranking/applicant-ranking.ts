import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf, NgFor, NgClass, DatePipe, PercentPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobApplicationsService } from '../../../core/services/job-applications.service';
import { JobService } from '../../../core/services/job.service';
import { StudentProfileService } from '../../../core/services/student-profile.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';

@Component({
  selector: 'app-applicant-ranking',
  imports: [Navbar, Footer, NgIf, NgFor, NgClass, DatePipe, PercentPipe, DecimalPipe, FormsModule],
  templateUrl: './applicant-ranking.html',
  styleUrl: './applicant-ranking.css'
})
export class ApplicantRanking implements OnInit {
  jobId = '';
  jobTitle = signal<string>('Loading Role...');
  applicants = signal<any[]>([]);
  filteredApplicants = signal<any[]>([]);
  isLoading = signal<boolean>(false);
  
  // Search and filter state
  searchTerm = '';
  statusFilter = 'ALL';
  statusOptions = ['ALL', 'APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED'];

  // Detail Modal / Sidebar
  selectedApplicant = signal<any | null>(null);
  selectedProfile = signal<any | null>(null);
  isLoadingProfile = signal<boolean>(false);
  feedbackText = '';
  isStatusSubmitting = signal<boolean>(false);

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly jobService: JobService,
    private readonly applicationsService: JobApplicationsService,
    private readonly studentProfileService: StudentProfileService,
    public readonly router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('jobId');
      if (id) {
        this.jobId = id;
        this.loadJobDetails();
        this.loadApplicants();
      }
    });
  }

  loadJobDetails(): void {
    // Fetch jobs and find matching one to get the title
    this.jobService.getMyJobs().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const match = res.data.find((j: any) => j.id === this.jobId);
          if (match) {
            this.jobTitle.set(match.title);
          }
        }
      }
    });
  }

  loadApplicants(): void {
    this.isLoading.set(true);
    this.applicationsService.getJobApplications(this.jobId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.applicants.set(res.data);
          this.applyFilter();
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to load candidate list.');
        console.error(err);
      }
    });
  }

  applyFilter(): void {
    let result = [...this.applicants()];

    // Status filter
    if (this.statusFilter !== 'ALL') {
      result = result.filter(a => a.status === this.statusFilter);
    }

    // Name search
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(a => a.studentName.toLowerCase().includes(term));
    }

    this.filteredApplicants.set(result);
  }

  selectApplicant(app: any): void {
    this.selectedApplicant.set(app);
    this.feedbackText = app.feedback || '';
    this.selectedProfile.set(null);
    this.isLoadingProfile.set(true);

    this.studentProfileService.getProfileById(app.studentId).subscribe({
      next: (res) => {
        this.isLoadingProfile.set(false);
        if (res.success && res.data) {
          this.selectedProfile.set(res.data);
        }
      },
      error: (err) => {
        this.isLoadingProfile.set(false);
        console.error('Failed to load candidate full profile:', err);
      }
    });

    // Auto-update to Under Review (VIEWED) if status is currently APPLIED
    if (app.status === 'APPLIED') {
      this.applicationsService.updateStatus(app.id, 'VIEWED', 'Reviewing applicant profile').subscribe({
        next: (res) => {
          if (res.success) {
            app.status = 'VIEWED';
            app.feedback = 'Reviewing applicant profile';
            this.applyFilter();
          }
        }
      });
    }
  }

  closeDetails(): void {
    this.selectedApplicant.set(null);
    this.selectedProfile.set(null);
  }

  updateStatus(status: string): void {
    const app = this.selectedApplicant();
    if (!app) return;

    this.isStatusSubmitting.set(true);
    this.applicationsService.updateStatus(app.id, status, this.feedbackText).subscribe({
      next: (res) => {
        this.isStatusSubmitting.set(false);
        if (res.success) {
          this.showSuccess(`Candidate status updated to: ${status}`);
          this.closeDetails();
          this.loadApplicants();
        }
      },
      error: (err) => {
        this.isStatusSubmitting.set(false);
        this.errorMessage.set('Failed to update candidate status.');
        console.error(err);
      }
    });
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      APPLIED: 'status-applied',
      VIEWED: 'status-viewed',
      SHORTLISTED: 'status-shortlisted',
      INTERVIEW: 'status-interview',
      OFFER: 'status-offer',
      ACCEPTED: 'status-accepted',
      REJECTED: 'status-rejected',
    };
    return map[status] || '';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      APPLIED: 'Applied',
      VIEWED: 'Under Review',
      SHORTLISTED: 'Shortlisted',
      INTERVIEW: 'Interview',
      OFFER: 'Offer Extended',
      ACCEPTED: 'Accepted',
      REJECTED: 'Rejected',
    };
    return map[status] || status;
  }

  getScoreColorClass(score: number): string {
    if (score >= 85) return 'score-high';
    if (score >= 70) return 'score-mid';
    return 'score-low';
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }

  backToJobs(): void {
    this.router.navigate(['/recruiter/jobs']);
  }
}
