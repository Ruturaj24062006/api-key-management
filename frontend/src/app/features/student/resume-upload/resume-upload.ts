import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { StudentProfileService } from '../../../core/services/student-profile.service';

@Component({
  selector: 'app-resume-upload',
  imports: [NgIf],
  templateUrl: './resume-upload.html',
  styleUrl: './resume-upload.css'
})
export class ResumeUpload implements OnInit, OnDestroy {
  isDragging = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  
  // States: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  status = signal<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  uploadProgress = signal<number>(0);
  
  private pollIntervalId: any = null;

  constructor(
    private readonly profileService: StudentProfileService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.checkCurrentResumeStatus();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private checkCurrentResumeStatus(): void {
    this.profileService.getResumeStatus().subscribe({
      next: (res) => {
        if (res.data === 'PROCESSING') {
          this.status.set('processing');
          this.startPolling();
        }
      },
      error: (err) => {
        console.warn('Failed to check current resume status:', err);
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    this.errorMessage.set(null);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    this.errorMessage.set(null);
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  private handleFile(file: File): void {
    // 1. Validation: Size (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.errorMessage.set('File size exceeds the 10MB limit.');
      return;
    }

    // 2. Validation: Content Type or Extension
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isValidExt = ['pdf', 'docx', 'doc'].includes(ext || '');
    const isValidMime = allowedTypes.includes(file.type);

    if (!isValidMime && !isValidExt) {
      this.errorMessage.set('Supported formats: PDF, DOCX, DOC.');
      return;
    }

    this.upload(file);
  }

  private upload(file: File): void {
    this.status.set('uploading');
    this.uploadProgress.set(20);

    const progressSim = setInterval(() => {
      if (this.uploadProgress() < 90) {
        this.uploadProgress.update(p => p + 15);
      } else {
        clearInterval(progressSim);
      }
    }, 200);

    this.profileService.uploadResume(file).subscribe({
      next: (res) => {
        clearInterval(progressSim);
        this.uploadProgress.set(100);
        this.status.set('processing');
        this.startPolling();
      },
      error: (err) => {
        clearInterval(progressSim);
        this.status.set('error');
        this.errorMessage.set(err.error?.message || 'Failed to upload resume. Please try again.');
      }
    });
  }

  private startPolling(): void {
    this.stopPolling();
    let pollCount = 0;
    const maxPolls = 30; // 60 seconds max

    this.pollIntervalId = setInterval(() => {
      pollCount++;
      if (pollCount > maxPolls) {
        this.stopPolling();
        this.status.set('error');
        this.errorMessage.set('Resume processing timed out. Please try again or refresh.');
        return;
      }

      this.profileService.getResumeStatus().subscribe({
        next: (res) => {
          const state = res.data;
          if (state === 'SUCCESS') {
            this.stopPolling();
            this.status.set('success');
            this.successMessage.set('AI successfully extracted your profile details!');
            setTimeout(() => {
              this.router.navigate(['/student/profile-review']);
            }, 1500);
          } else if (state === 'FAILED') {
            this.stopPolling();
            this.status.set('error');
            this.errorMessage.set('AI could not extract structured data. Please try another file.');
          }
        },
        error: (err) => {
          console.warn('Error polling resume status:', err);
        }
      });
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  reset(): void {
    this.status.set('idle');
    this.uploadProgress.set(0);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
