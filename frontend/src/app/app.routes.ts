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
import { RecruiterDashboard } from './features/recruiter/dashboard/recruiter-dashboard';
import { AdminDashboard } from './features/admin/dashboard/admin-dashboard';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'unauthorized', component: Unauthorized },
  
  // Protected Routes
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
    path: 'recruiter/dashboard', 
    component: RecruiterDashboard, 
    canActivate: [authGuard, roleGuard], 
    data: { roles: ['ROLE_RECRUITER'] } 
  },
  { 
    path: 'admin/dashboard', 
    component: AdminDashboard, 
    canActivate: [authGuard, roleGuard], 
    data: { roles: ['ROLE_ADMIN'] } 
  },
  
  // Catch-all
  { path: '**', redirectTo: '' }
];
