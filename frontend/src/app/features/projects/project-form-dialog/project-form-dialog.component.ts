import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ProjectService } from '../../../core/services/project.service';
import { Environment } from '../../../core/models/project.model';

export interface ProjectFormDialogData {
  organizationId: string;
}

@Component({
  selector: 'kf-project-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>New Project</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="kf-project-form">
        <mat-form-field appearance="outline" class="kf-full-width">
          <mat-label>Project name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="kf-full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="kf-full-width">
          <mat-label>Environment</mat-label>
          <mat-select formControlName="environment">
            <mat-option value="DEVELOPMENT">Development</mat-option>
            <mat-option value="STAGING">Staging</mat-option>
            <mat-option value="PRODUCTION">Production</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || submitting()" (click)="submit()">
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .kf-project-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 8px;
    }
  `],
})
export class ProjectFormDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<ProjectFormDialogComponent>);
  private readonly data = inject<ProjectFormDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);

  submitting = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    environment: ['DEVELOPMENT' as Environment, [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.projectService.create(this.data.organizationId, this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }
}
