import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';
import { 
  AdminService, 
  AdminStats, 
  AdminStudent, 
  AdminRecruiter, 
  AdminCompany, 
  AdminJob 
} from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [Navbar, Footer, NgIf, NgFor, DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
  activeTab = signal<string>('OVERVIEW');
  
  // Data Signals
  stats = signal<AdminStats | null>(null);
  students = signal<AdminStudent[]>([]);
  recruiters = signal<AdminRecruiter[]>([]);
  companies = signal<AdminCompany[]>([]);
  jobs = signal<AdminJob[]>([]);

  // Loading states
  isLoading = signal<boolean>(false);

  constructor(
    private readonly authService: AuthService,
    private readonly adminService: AdminService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  setTab(tab: string): void {
    this.activeTab.set(tab);
    if (tab === 'OVERVIEW') this.loadOverview();
    else if (tab === 'COMPANIES') this.loadCompanies();
    else if (tab === 'STUDENTS') this.loadStudents();
    else if (tab === 'RECRUITERS') this.loadRecruiters();
    else if (tab === 'JOBS') this.loadJobs();
  }

  loadOverview(): void {
    this.isLoading.set(true);
    this.adminService.getStats().subscribe({
      next: (res) => {
        if (res.success) this.stats.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load admin stats:', err);
        this.isLoading.set(false);
      }
    });
  }

  loadStudents(): void {
    this.isLoading.set(true);
    this.adminService.getStudents().subscribe({
      next: (res) => {
        if (res.success) this.students.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load students:', err);
        this.isLoading.set(false);
      }
    });
  }

  loadRecruiters(): void {
    this.isLoading.set(true);
    this.adminService.getRecruiters().subscribe({
      next: (res) => {
        if (res.success) this.recruiters.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load recruiters:', err);
        this.isLoading.set(false);
      }
    });
  }

  loadCompanies(): void {
    this.isLoading.set(true);
    this.adminService.getCompanies().subscribe({
      next: (res) => {
        if (res.success) this.companies.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load companies:', err);
        this.isLoading.set(false);
      }
    });
  }

  loadJobs(): void {
    this.isLoading.set(true);
    this.adminService.getJobs().subscribe({
      next: (res) => {
        if (res.success) this.jobs.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load jobs:', err);
        this.isLoading.set(false);
      }
    });
  }

  toggleSuspension(userId: string): void {
    if (confirm('Are you sure you want to change this user\'s access credentials status?')) {
      this.adminService.toggleSuspension(userId).subscribe({
        next: () => {
          this.loadStudents();
          this.loadRecruiters();
        },
        error: (err) => console.error('Failed to toggle suspension:', err)
      });
    }
  }

  verifyCompany(companyId: string): void {
    if (confirm('Verify company and approve all linked recruiter registrations?')) {
      this.adminService.verifyCompany(companyId).subscribe({
        next: () => this.loadCompanies(),
        error: (err) => console.error('Failed to verify company:', err)
      });
    }
  }

  deleteJob(jobId: string): void {
    if (confirm('Are you sure you want to delete this job post (e.g. fraudulent)? This is permanent.')) {
      this.adminService.deleteJob(jobId).subscribe({
        next: () => this.loadJobs(),
        error: (err) => console.error('Failed to delete job:', err)
      });
    }
  }

  getUserEmail(): string {
    return this.authService.currentUser()?.email || 'N/A';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
