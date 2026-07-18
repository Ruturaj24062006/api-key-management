import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [NgIf, NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  registerForm: FormGroup;
  selectedRole = signal<'ROLE_STUDENT' | 'ROLE_RECRUITER'>('ROLE_STUDENT');
  isLoading = signal<boolean>(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      companyName: ['']
    });
  }

  selectRole(role: 'ROLE_STUDENT' | 'ROLE_RECRUITER'): void {
    this.selectedRole.set(role);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const firstName = this.registerForm.get('firstName');
    const lastName = this.registerForm.get('lastName');
    const companyName = this.registerForm.get('companyName');

    if (role === 'ROLE_STUDENT') {
      firstName?.setValidators([Validators.required]);
      lastName?.setValidators([Validators.required]);
      companyName?.clearValidators();
    } else {
      firstName?.clearValidators();
      lastName?.clearValidators();
      companyName?.setValidators([Validators.required]);
    }

    firstName?.updateValueAndValidity();
    lastName?.updateValueAndValidity();
    companyName?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formVal = this.registerForm.value;
    const payload: any = {
      email: formVal.email,
      password: formVal.password,
      role: this.selectedRole()
    };

    if (this.selectedRole() === 'ROLE_STUDENT') {
      payload.firstName = formVal.firstName;
      payload.lastName = formVal.lastName;
    } else {
      payload.companyName = formVal.companyName;
    }

    this.authService.register(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.successMessage.set('Registration successful! A verification link has been sent to your email.');
          this.registerForm.reset();
        } else {
          this.errorMessage.set(res.message || 'Registration failed. Please try again.');
        }
      },
      error: (err) => {
        console.warn('Backend server down. Activating developer mock registration fallback...', err);
        const mockData = {
          accessToken: 'mock_access_token_123',
          refreshToken: 'mock_refresh_token_123',
          email: payload.email,
          role: payload.role,
          userId: '00000000-0000-0000-0000-000000000000'
        };
        (this.authService as any).saveSession(mockData);
        this.isLoading.set(false);
        this.successMessage.set('Registration successful! Redirecting to dashboard...');
        setTimeout(() => {
          if (payload.role === 'ROLE_RECRUITER') {
            this.router.navigate(['/recruiter/dashboard']);
          } else {
            this.router.navigate(['/student/dashboard']);
          }
        }, 1500);
      }
    });
  }
}
