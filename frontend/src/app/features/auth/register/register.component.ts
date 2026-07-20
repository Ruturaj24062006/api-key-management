import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { ApiErrorResponse } from '../../../core/models/api-error.model';

@Component({
  selector: 'kf-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="kf-auth-page">
      <mat-card class="kf-auth-card">
        <div class="kf-auth-card__brand">KeyForge</div>
        <h1>Create your account</h1>
        <p class="kf-auth-card__subtitle">Start managing API keys for your organization</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="kf-full-width">
            <mat-label>Full name</mat-label>
            <input matInput formControlName="fullName" autocomplete="name" />
            @if (form.controls.fullName.hasError('required') && form.controls.fullName.touched) {
              <mat-error>Full name is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="kf-full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.hasError('required') && form.controls.email.touched) {
              <mat-error>Email is required</mat-error>
            }
            @if (form.controls.email.hasError('email') && form.controls.email.touched) {
              <mat-error>Enter a valid email</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="kf-full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
            @if (form.controls.password.hasError('required') && form.controls.password.touched) {
              <mat-error>Password is required</mat-error>
            }
            @if (form.controls.password.hasError('minlength') && form.controls.password.touched) {
              <mat-error>Password must be at least 8 characters</mat-error>
            }
          </mat-form-field>

          @if (errorMessage()) {
            <div class="kf-auth-card__error">{{ errorMessage() }}</div>
          }

          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="kf-full-width kf-auth-card__submit"
            [disabled]="form.invalid || loading()"
          >
            @if (loading()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              Create account
            }
          </button>
        </form>

        <p class="kf-auth-card__footer">
          Already have an account? <a routerLink="/login">Sign in</a>
        </p>
      </mat-card>
    </div>
  `,
  styles: [`
    .kf-auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1d24 0%, #2d3250 100%);
      padding: 24px;
    }

    .kf-auth-card {
      width: 100%;
      max-width: 400px;
      padding: 32px;
    }

    .kf-auth-card__brand {
      font-weight: 700;
      font-size: 20px;
      color: #3f51b5;
      margin-bottom: 24px;
    }

    h1 {
      font-size: 22px;
      margin: 0 0 4px 0;
    }

    .kf-auth-card__subtitle {
      color: rgba(0, 0, 0, 0.6);
      margin: 0 0 24px 0;
      font-size: 14px;
    }

    .kf-auth-card__submit {
      margin-top: 8px;
      height: 44px;
    }

    .kf-auth-card__error {
      background: #fdeaea;
      color: #b3261e;
      padding: 10px 12px;
      border-radius: 4px;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .kf-auth-card__footer {
      text-align: center;
      margin-top: 20px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }
  `],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ApiErrorResponse | undefined;
        this.errorMessage.set(body?.message ?? 'Unable to create account. Please try again.');
      },
    });
  }
}
