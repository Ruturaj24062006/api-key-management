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
      role: this.selectedRole()   // Always ROLE_STUDENT or ROLE_RECRUITER
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
          this.selectedRole.set('ROLE_STUDENT');
        } else {
          this.errorMessage.set(res.message || 'Registration failed. Please try again.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);

        if (err.status === 0) {
          // Backend unreachable — do NOT create a fake session.
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
