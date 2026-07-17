import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobService, JobCreateDto } from '../../../core/services/job.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';

@Component({
  selector: 'app-recruiter-jobs',
  imports: [Navbar, Footer, NgIf, NgFor, NgClass, DatePipe, FormsModule],
  templateUrl: './recruiter-jobs.html',
  styleUrl: './recruiter-jobs.css'
})
export class RecruiterJobs implements OnInit {
  jobs = signal<any[]>([]);
  filteredJobs = signal<any[]>([]);
  isLoading = signal<boolean>(false);
  activeFilter = signal<string>('ALL');

  // Edit modal state
  isEditModalOpen = signal<boolean>(false);
  editingJob = signal<any | null>(null);
  isSaving = signal<boolean>(false);

  // Delete confirm state
  deletingJobId = signal<string | null>(null);

  // Status update in-flight
  updatingStatusId = signal<string | null>(null);

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  editForm: JobCreateDto = {
    title: '', description: '', requirements: '', location: '',
    jobType: 'FULL_TIME', experienceLevel: '', salaryRange: '',
    requiredSkills: '', preferredSkills: '', workMode: 'HYBRID',
    educationLevel: '', sponsorshipAvailable: false
  };

  jobTypes = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'REMOTE'];
  workModes = ['ONSITE', 'HYBRID', 'REMOTE'];
  statusFilters = ['ALL', 'ACTIVE', 'PAUSED', 'DRAFT', 'CLOSED'];

  constructor(
    private readonly jobService: JobService,
    public readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.isLoading.set(true);
    this.jobService.getMyJobs().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.jobs.set(res.data);
          this.applyFilter();
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed to load jobs.');
        console.error(err);
      }
    });
  }

  setFilter(filter: string): void {
    this.activeFilter.set(filter);
    this.applyFilter();
  }

  applyFilter(): void {
    const f = this.activeFilter();
    if (f === 'ALL') {
      this.filteredJobs.set([...this.jobs()]);
    } else {
      this.filteredJobs.set(this.jobs().filter(j => j.status === f));
    }
  }

  openEditModal(job: any): void {
    this.editingJob.set(job);
    this.editForm = {
      title: job.title,
      description: job.description,
      requirements: job.requirements || '',
      location: job.location || '',
      jobType: job.jobType,
      experienceLevel: job.experienceLevel || '',
      salaryRange: job.salaryRange || '',
      requiredSkills: job.requiredSkills || '',
      preferredSkills: job.preferredSkills || '',
      workMode: job.workMode || 'HYBRID',
      educationLevel: job.educationLevel || '',
      sponsorshipAvailable: job.sponsorshipAvailable || false
    };
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.editingJob.set(null);
  }

  saveEdit(): void {
    const job = this.editingJob();
    if (!job) return;
    this.isSaving.set(true);
    this.jobService.updateJob(job.id, this.editForm).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        if (res.success) {
          this.showSuccess('Job updated successfully.');
          this.closeEditModal();
          this.loadJobs();
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set('Failed to update job.');
        console.error(err);
      }
    });
  }

  changeStatus(job: any, newStatus: string): void {
    this.updatingStatusId.set(job.id);
    this.jobService.updateJobStatus(job.id, newStatus).subscribe({
      next: (res) => {
        this.updatingStatusId.set(null);
        if (res.success) {
          this.showSuccess(`Job "${job.title}" is now ${newStatus}.`);
          this.loadJobs();
        }
      },
      error: (err) => {
        this.updatingStatusId.set(null);
        this.errorMessage.set('Status update failed.');
        console.error(err);
      }
    });
  }

  confirmDelete(jobId: string): void {
    this.deletingJobId.set(jobId);
  }

  cancelDelete(): void {
    this.deletingJobId.set(null);
  }

  executeDelete(jobId: string): void {
    this.jobService.deleteJob(jobId).subscribe({
      next: (res) => {
        this.deletingJobId.set(null);
        this.showSuccess('Job deleted.');
        this.loadJobs();
      },
      error: (err) => {
        this.deletingJobId.set(null);
        this.errorMessage.set('Failed to delete job.');
        console.error(err);
      }
    });
  }

  getStatusMeta(status: string): { label: string; cssClass: string } {
    const map: Record<string, { label: string; cssClass: string }> = {
      DRAFT:  { label: 'Draft',   cssClass: 'status-draft' },
      ACTIVE: { label: 'Active',  cssClass: 'status-active' },
      PAUSED: { label: 'Paused',  cssClass: 'status-paused' },
      CLOSED: { label: 'Closed',  cssClass: 'status-closed' },
    };
    return map[status] || { label: status, cssClass: '' };
  }

  getNextActions(status: string): { label: string; newStatus: string; btnClass: string }[] {
    switch (status) {
      case 'DRAFT':  return [{ label: 'Publish', newStatus: 'ACTIVE', btnClass: 'btn-success' }];
      case 'ACTIVE': return [
        { label: 'Pause',  newStatus: 'PAUSED', btnClass: 'btn-warning' },
        { label: 'Close',  newStatus: 'CLOSED', btnClass: 'btn-danger-outline' },
      ];
      case 'PAUSED': return [
        { label: 'Reopen', newStatus: 'ACTIVE', btnClass: 'btn-success' },
        { label: 'Close',  newStatus: 'CLOSED', btnClass: 'btn-danger-outline' },
      ];
      case 'CLOSED': return [{ label: 'Reopen', newStatus: 'ACTIVE', btnClass: 'btn-success' }];
      default: return [];
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }

  countByStatus(status: string): number {
    return this.jobs().filter(j => j.status === status).length;
  }
}
