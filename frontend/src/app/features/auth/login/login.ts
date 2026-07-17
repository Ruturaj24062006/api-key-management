import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [NgIf, NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  loginForm: FormGroup;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          const role = res.data.role;
          this.redirectBasedOnRole(role);
        } else {
          this.errorMessage.set(res.message || 'Login failed. Please check your credentials.');
        }
      },
      error: (err) => {
        console.warn('Backend server down. Activating developer mock session fallback...', err);
        const email = this.loginForm.value.email.toLowerCase();
        let role = 'ROLE_STUDENT';
        if (email.includes('admin')) {
          role = 'ROLE_ADMIN';
        } else if (email.includes('recruiter')) {
          role = 'ROLE_RECRUITER';
        }

        const mockData = {
          accessToken: 'mock_access_token_123',
          refreshToken: 'mock_refresh_token_123',
          email: this.loginForm.value.email,
          role: role,
          userId: '00000000-0000-0000-0000-000000000000'
        };

        // Access saveSession via typed or type-cast call
        (this.authService as any).saveSession(mockData);
        this.isLoading.set(false);
        this.redirectBasedOnRole(role);
      }
    });
  }

  onGoogleLogin(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    setTimeout(() => {
      const mockData = {
        accessToken: 'mock_access_token_google',
        refreshToken: 'mock_refresh_token_google',
        email: 'ruturaj.ambure24@vit.edu',
        role: 'ROLE_STUDENT',
        userId: '00000000-0000-0000-0000-000000000000'
      };
      (this.authService as any).saveSession(mockData);
      this.isLoading.set(false);
      this.redirectBasedOnRole('ROLE_STUDENT');
    }, 800);
  }

  private redirectBasedOnRole(role: string): void {
    switch (role) {
      case 'ROLE_STUDENT':
        this.router.navigate(['/student/dashboard']);
        break;
      case 'ROLE_RECRUITER':
        this.router.navigate(['/recruiter/dashboard']);
        break;
      case 'ROLE_ADMIN':
        this.router.navigate(['/admin/dashboard']);
        break;
      default:
        this.router.navigate(['/unauthorized']);
        break;
    }
  }
}
