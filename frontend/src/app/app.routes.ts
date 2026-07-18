import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Unauthorized } from './features/auth/unauthorized/unauthorized';
import { StudentDashboard } from './features/student/dashboard/student-dashboard';
import { Onboarding } from './features/student/onboarding/onboarding';
import { ResumeUpload } from './features/student/resume-upload/resume-upload';
import { ProfileReview } from './features/student/profile-review/profile-review';
import { RecruiterDashboard } from './features/recruiter/dashboard/recruiter-dashboard';
import { RecruiterOnboarding } from './features/recruiter/onboarding/onboarding';
import { CreateJob } from './features/recruiter/create-job/create-job';
import { RecruiterJobs } from './features/recruiter/jobs/recruiter-jobs';
import { ApplicantRanking } from './features/recruiter/applicant-ranking/applicant-ranking';
import { AdminDashboard } from './features/admin/dashboard/admin-dashboard';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { inject } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { Router } from '@angular/router';

export const routes: Routes = [
  // Public routes
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'unauthorized', component: Unauthorized },

  /**
   * Generic /dashboard redirect — resolves to the correct dashboard
   * based on the authenticated user's actual role.
   * Useful for post-login redirects and "go to my dashboard" links.
   */
  {
    path: 'dashboard',
    canActivate: [
      authGuard,
      () => {
        const authService = inject(AuthService);
        const router = inject(Router);
        authService.redirectToDashboard(router);
        return false; // Always redirect — never render a component at /dashboard
      }
    ],
    component: Landing   // Placeholder — never reached due to redirect above
  },

  // ─── Student Routes ─────────────────────────────────────────────────────────
  {
    path: 'student/dashboard',
    component: StudentDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_STUDENT'] }
  },
  {
    path: 'student/onboarding',
    component: Onboarding,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_STUDENT'] }
  },
  {
    path: 'student/resume-upload',
    component: ResumeUpload,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_STUDENT'] }
  },
  {
    path: 'student/profile-review',
    component: ProfileReview,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_STUDENT'] }
  },

  // ─── Recruiter Routes ────────────────────────────────────────────────────────
  {
    path: 'recruiter/dashboard',
    component: RecruiterDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_RECRUITER'] }
  },
  {
    path: 'recruiter/onboarding',
    component: RecruiterOnboarding,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_RECRUITER'] }
  },
  {
    path: 'recruiter/jobs/create',
    component: CreateJob,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_RECRUITER'] }
  },
  {
    path: 'recruiter/jobs',
    component: RecruiterJobs,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_RECRUITER'] }
  },
  {
    path: 'recruiter/jobs/:jobId/applicants',
    component: ApplicantRanking,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_RECRUITER'] }
  },

  // ─── Admin Routes ────────────────────────────────────────────────────────────
  {
    path: 'admin/dashboard',
    component: AdminDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_ADMIN'] }
  },

  // Catch-all
  { path: '**', redirectTo: '' }
];
