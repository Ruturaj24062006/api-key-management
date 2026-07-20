import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../../core/services/project.service';
import { SessionStateService } from '../../../core/state/session-state.service';
import { Project } from '../../../core/models/project.model';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';

@Component({
  selector: 'kf-project-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <h1>Projects</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          New Project
        </button>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Loading projects..."></kf-loading-spinner>
      } @else if (projects().length === 0) {
        <kf-empty-state
          icon="folder_open"
          title="No projects yet"
          message="Create a project to start generating API keys."
          actionLabel="New Project"
          (actionClicked)="openCreateDialog()"
        ></kf-empty-state>
      } @else {
        <table mat-table [dataSource]="projects()" class="mat-elevation-z1 kf-full-width">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let project">
              <a class="kf-project-link" (click)="openProject(project)">{{ project.name }}</a>
            </td>
          </ng-container>

          <ng-container matColumnDef="environment">
            <th mat-header-cell *matHeaderCellDef>Environment</th>
            <td mat-cell *matCellDef="let project">
              <mat-chip>{{ project.environment }}</mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="activeKeys">
            <th mat-header-cell *matHeaderCellDef>Active Keys</th>
            <td mat-cell *matCellDef="let project">{{ project.activeKeyCount }}</td>
          </ng-container>

          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Created</th>
            <td mat-cell *matCellDef="let project">{{ project.createdAt | date: 'mediumDate' }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns" (click)="openProject(row)" class="kf-project-row"></tr>
        </table>
      }
    </div>
  `,
  styles: [`
    .kf-project-link {
      color: #3f51b5;
      cursor: pointer;
      font-weight: 500;
    }

    .kf-project-row {
      cursor: pointer;
    }

    .kf-project-row:hover {
      background: rgba(0, 0, 0, 0.02);
    }
  `],
})
export class ProjectListComponent {
  private readonly projectService = inject(ProjectService);
  private readonly sessionState = inject(SessionStateService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  projects = signal<Project[]>([]);
  loading = signal(true);
  displayedColumns = ['name', 'environment', 'activeKeys', 'createdAt'];

  constructor() {
    // Reactively reload whenever the selected org changes (fixes race condition
    // where the org list arrives after this component initialises).
    effect(() => {
      const orgId = this.sessionState.currentOrgId();
      if (orgId) {
        this.load();
      } else {
        this.loading.set(false);
      }
    });
  }

  load(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.projectService.list(orgId).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openProject(project: Project): void {
    this.router.navigate(['/projects', project.id, 'keys']);
  }

  openCreateDialog(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    const ref = this.dialog.open(ProjectFormDialogComponent, {
      width: '480px',
      data: { organizationId: orgId },
    });

    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.load();
      }
    });
  }
}
