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
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      companyName: ['']
    });
  }

  selectRole(role: 'ROLE_STUDENT' | 'ROLE_RECRUITER'): void {
    this.selectedRole.set(role);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const companyName = this.registerForm.get('companyName');

    if (role === 'ROLE_STUDENT') {
      companyName?.clearValidators();
    } else {
      companyName?.setValidators([Validators.required]);
    }

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
    const parts = (formVal.fullName || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const payload: any = {
      email: formVal.email,
      password: formVal.password,
      role: this.selectedRole(),
      firstName: firstName,
      lastName: lastName
    };

    if (this.selectedRole() === 'ROLE_RECRUITER') {
      payload.companyName = formVal.companyName;
    }

    this.authService.register(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.successMessage.set('Registration successful! Please proceed to the login page.');
        } else {
          this.errorMessage.set(res.message || 'Registration failed. Please try again.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);

        if (err.status === 0) {
          this.errorMessage.set(
            'Cannot reach the server. Please check your connection or try again later.'
          );
          console.warn('Backend server is unreachable during registration.', err);
        } else {
          const backendMsg = err.error?.message || err.error?.error || 'Registration failed. Please try again.';
          this.errorMessage.set(backendMsg);
        }
      }
    });
  }
}
