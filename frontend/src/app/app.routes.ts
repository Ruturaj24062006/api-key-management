import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/project-list/project-list.component').then(
            (m) => m.ProjectListComponent
          ),
      },
      {
        path: 'projects/:projectId/keys',
        loadComponent: () =>
          import('./features/api-keys/api-key-list/api-key-list.component').then(
            (m) => m.ApiKeyListComponent
          ),
      },
      {
        path: 'projects/:projectId/keys/:keyId/analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then((m) => m.AnalyticsComponent),
      },
      {
        path: 'audit-log',
        loadComponent: () =>
          import('./features/audit-log/audit-log.component').then((m) => m.AuditLogComponent),
      },
      {
        path: 'admin-console',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin-console/admin-console.component').then(
            (m) => m.AdminConsoleComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
