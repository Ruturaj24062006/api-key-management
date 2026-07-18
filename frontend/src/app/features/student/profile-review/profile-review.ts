import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf, NgFor, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentProfileService } from '../../../core/services/student-profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { JobMatchesService } from '../../../core/services/job-matches.service';

@Component({
  selector: 'app-profile-review',
  imports: [NgIf, NgFor, FormsModule, SlicePipe],
  templateUrl: './profile-review.html',
  styleUrl: './profile-review.css'
})
export class ProfileReview implements OnInit {

  // ── Loading / status ──────────────────────────────────────────────────────
  isLoading = signal<boolean>(true);
  isSaving  = signal<boolean>(false);
  errorMessage   = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // ── Active section tab ────────────────────────────────────────────────────
  activeSection = signal<string>('personal');

  readonly sections = [
    { id: 'personal',       icon: '👤', label: 'Personal'       },
    { id: 'professional',   icon: '💼', label: 'Professional'   },
    { id: 'skills',         icon: '⚡', label: 'Skills'         },
    { id: 'education',      icon: '🎓', label: 'Education'      },
    { id: 'experience',     icon: '🏢', label: 'Experience'     },
    { id: 'projects',       icon: '🚀', label: 'Projects'       },
    { id: 'certifications', icon: '🏆', label: 'Certifications' },
    { id: 'resume',         icon: '📄', label: 'Resume'         },
    { id: 'account',        icon: '⚙️',  label: 'Account'        },
  ];

  // ── Personal Info ─────────────────────────────────────────────────────────
  firstName    = '';
  lastName     = '';
  email        = '';   // read-only
  phone        = '';
  dateOfBirth  = '';
  gender       = '';
  city         = '';
  state        = '';
  country      = '';
  linkedinUrl  = '';
  githubUrl    = '';
  portfolioUrl = '';
  avatarInitial = computed(() => (this.firstName || this.email || 'S').charAt(0).toUpperCase());

  // ── Professional ─────────────────────────────────────────────────────────
  targetRole      = '';
  yearsExperience = '';
  preferredCity   = '';
  workMode        = 'HYBRID';
  expectedSalary  = '';
  noticePeriod    = '';
  bio             = '';

  // ── Skills ───────────────────────────────────────────────────────────────
  technicalSkills: { name: string; proficiencyLevel: string }[] = [];
  softSkills:  string[] = [];
  languages    = '';
  newSoftSkill = '';

  // ── Education ────────────────────────────────────────────────────────────
  education: {
    institution: string; degree: string; fieldOfStudy: string;
    startDate: string; endDate: string; gpa: number | null;
  }[] = [];

  // ── Experience ────────────────────────────────────────────────────────────
  experience: {
    companyName: string; jobTitle: string;
    startDate: string; endDate: string; description: string;
  }[] = [];

  // ── Projects ─────────────────────────────────────────────────────────────
  projects: {
    name: string; description: string;
    repoUrl: string; liveUrl: string; technologies: string;
  }[] = [];

  // ── Certifications ───────────────────────────────────────────────────────
  certifications: {
    name: string; issuingOrganization: string;
    issueDate: string; expirationDate: string; credentialUrl: string;
  }[] = [];

  // ── Resume ───────────────────────────────────────────────────────────────
  resumeId     = signal<string | null>(null);
  resumeStatus = signal<string>('');
  resumeUploadedAt = signal<string>('');

  // ── Upload modal (inline) ─────────────────────────────────────────────────
  isUploadModalOpen  = signal<boolean>(false);
  uploadStep         = signal<'select' | 'uploading' | 'done' | 'error'>('select');
  uploadProgress     = signal<number>(0);
  uploadError        = signal<string | null>(null);
  processingStage    = signal<string>('');
  processingEtaSecs  = signal<number>(60);
  private modalPollId: any = null;
  private etaId: any = null;

  constructor(
    private readonly profileService: StudentProfileService,
    private readonly authService: AuthService,
    private readonly matchesService: JobMatchesService,
    public  readonly router: Router
  ) {}

  ngOnInit(): void {
    this.email = this.authService.currentUser()?.email || '';
    this.loadProfile();
    this.loadResumeStatus();
  }

  // ── Data Loading ──────────────────────────────────────────────────────────

  loadProfile(): void {
    this.isLoading.set(true);
    this.profileService.getProfile().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.mapProfileToForm(res.data);
        }
      },
      error: () => {
        this.isLoading.set(false);
        // If profile fetch fails, try loading from latest resume extraction
        this.loadFromResumeExtraction();
      }
    });
  }

  loadFromResumeExtraction(): void {
    this.profileService.getLatestResume().subscribe({
      next: (res) => {
        if (res.data?.extractedJson) {
          try {
            const p = typeof res.data.extractedJson === 'string'
              ? JSON.parse(res.data.extractedJson)
              : res.data.extractedJson;
            this.firstName     = p.firstName     || '';
            this.lastName      = p.lastName      || '';
            this.linkedinUrl   = p.linkedinUrl   || '';
            this.githubUrl     = p.githubUrl     || '';
            this.portfolioUrl  = p.portfolioUrl  || '';
            this.languages     = p.languages     || '';
            this.targetRole    = p.careerPreferences || '';
            this.technicalSkills = (p.skills || []).map((s: any) => ({
              name: s.name || s,
              proficiencyLevel: s.proficiencyLevel || 'INTERMEDIATE'
            }));
            this.education     = (p.education || []).map((e: any) => ({
              institution: e.institution || '', degree: e.degree || '',
              fieldOfStudy: e.fieldOfStudy || '', startDate: e.startDate || '',
              endDate: e.endDate || '', gpa: e.gpa ?? null
            }));
            this.experience    = (p.experience || []).map((e: any) => ({
              companyName: e.companyName || '', jobTitle: e.jobTitle || '',
              startDate: e.startDate || '', endDate: e.endDate || '',
              description: e.description || ''
            }));
            this.projects      = (p.projects || []).map((p2: any) => ({
              name: p2.name || '', description: p2.description || '',
              repoUrl: p2.repoUrl || '', liveUrl: '', technologies: p2.technologies || ''
            }));
            this.certifications = (p.certifications || []).map((c: any) => ({
              name: c.name || '', issuingOrganization: c.issuingOrganization || '',
              issueDate: c.issueDate || '', expirationDate: c.expirationDate || '',
              credentialUrl: ''
            }));
          } catch (e) { console.warn('Failed to parse extracted JSON', e); }
        }
      },
      error: () => {}
    });
  }

  private mapProfileToForm(data: any): void {
    this.firstName     = data.firstName     || '';
    this.lastName      = data.lastName      || '';
    this.phone         = data.phone         || '';
    this.dateOfBirth   = data.dateOfBirth   || '';
    this.gender        = data.gender        || '';
    this.city          = data.city          || '';
    this.state         = data.state         || '';
    this.country       = data.country       || '';
    this.linkedinUrl   = data.linkedinUrl   || '';
    this.githubUrl     = data.githubUrl     || '';
    this.portfolioUrl  = data.portfolioUrl  || '';
    this.bio           = data.bio           || '';
    this.languages     = data.languages     || '';
    this.noticePeriod  = data.noticePeriod  || '';

    // Parse career preferences string into fields
    if (data.careerPreferences) {
      const prefs = data.careerPreferences;
      const roleMatch = prefs.match(/Role:\s*([^;]+)/);
      const cityMatch = prefs.match(/City:\s*([^;]+)/);
      const modeMatch = prefs.match(/Mode:\s*([^;]+)/);
      const salaryMatch = prefs.match(/Salary:\s*([^;]+)/);
      const expMatch  = prefs.match(/Exp:\s*([^;]+)/);
      const noticeMatch = prefs.match(/Notice:\s*([^;]+)/);
      if (roleMatch)   this.targetRole      = roleMatch[1].trim();
      if (cityMatch)   this.preferredCity   = cityMatch[1].trim();
      if (modeMatch)   this.workMode        = modeMatch[1].trim();
      if (salaryMatch) this.expectedSalary  = salaryMatch[1].trim();
      if (expMatch)    this.yearsExperience = expMatch[1].trim();
      if (noticeMatch) this.noticePeriod    = noticeMatch[1].trim();
      // Fallback: if no pattern, treat full string as target role
      if (!roleMatch && !cityMatch) this.targetRole = prefs;
    }

    this.technicalSkills = (data.skills || []).map((s: any) => ({
      name: s.name || s, proficiencyLevel: s.proficiencyLevel || 'INTERMEDIATE'
    }));
    this.education     = (data.education || []).map((e: any) => ({
      institution: e.institution || '', degree: e.degree || '',
      fieldOfStudy: e.fieldOfStudy || '', startDate: e.startDate || '',
      endDate: e.endDate || '', gpa: e.gpa ?? null
    }));
    this.experience    = (data.experience || []).map((e: any) => ({
      companyName: e.companyName || '', jobTitle: e.jobTitle || '',
      startDate: e.startDate || '', endDate: e.endDate || '',
      description: e.description || ''
    }));
    this.projects      = (data.projects || []).map((p: any) => ({
      name: p.name || '', description: p.description || '',
      repoUrl: p.repoUrl || '', liveUrl: p.liveUrl || '',
      technologies: p.technologies || ''
    }));
    this.certifications = (data.certifications || []).map((c: any) => ({
      name: c.name || '', issuingOrganization: c.issuingOrganization || '',
      issueDate: c.issueDate || '', expirationDate: c.expirationDate || '',
      credentialUrl: c.credentialUrl || ''
    }));
  }

  loadResumeStatus(): void {
    this.profileService.getLatestResume().subscribe({
      next: (res) => {
        if (res.data) {
          this.resumeId.set(res.data.id);
          this.resumeStatus.set(res.data.processingStatus || '');
          this.resumeUploadedAt.set(res.data.createdAt || '');
        }
      },
      error: () => {}
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  saveProfile(): void {
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const prefs = [
      this.targetRole      ? `Role: ${this.targetRole}`           : '',
      this.preferredCity   ? `City: ${this.preferredCity}`         : '',
      this.workMode        ? `Mode: ${this.workMode}`              : '',
      this.expectedSalary  ? `Salary: ${this.expectedSalary}`      : '',
      this.yearsExperience ? `Exp: ${this.yearsExperience}`        : '',
      this.noticePeriod    ? `Notice: ${this.noticePeriod}`        : '',
    ].filter(Boolean).join('; ');

    const payload: any = {
      firstName:         this.firstName,
      lastName:          this.lastName,
      bio:               this.bio || `Actively searching for ${this.targetRole || 'opportunities'}.`,
      githubUrl:         this.githubUrl,
      linkedinUrl:       this.linkedinUrl,
      portfolioUrl:      this.portfolioUrl,
      languages:         this.languages,
      careerPreferences: prefs,
      skills:            this.technicalSkills,
      education:         this.education,
      experience:        this.experience,
      projects:          this.projects,
      certifications:    this.certifications,
      profileCompletedPct: this.computeCompletionPct(),
    };

    this.profileService.updateProfile(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Profile saved successfully!');
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to save profile. Please try again.');
      }
    });
  }

  computeCompletionPct(): number {
    let score = 0;
    if (this.firstName)           score += 10;
    if (this.lastName)            score += 5;
    if (this.linkedinUrl)         score += 5;
    if (this.githubUrl)           score += 5;
    if (this.targetRole)          score += 10;
    if (this.technicalSkills.length > 0) score += 20;
    if (this.education.length > 0)       score += 20;
    if (this.experience.length > 0)      score += 15;
    if (this.projects.length > 0)        score += 10;
    return Math.min(score, 100);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  setSection(id: string): void { this.activeSection.set(id); }

  // ── Skills helpers ────────────────────────────────────────────────────────
  addTechSkill()  { this.technicalSkills.push({ name: '', proficiencyLevel: 'INTERMEDIATE' }); }
  removeTechSkill(i: number) { this.technicalSkills.splice(i, 1); }

  addSoftSkill(): void {
    const s = this.newSoftSkill.trim();
    if (s) { this.softSkills.push(s); this.newSoftSkill = ''; }
  }
  removeSoftSkill(i: number) { this.softSkills.splice(i, 1); }

  // ── Education helpers ─────────────────────────────────────────────────────
  addEducation() {
    this.education.push({ institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', gpa: null });
  }
  removeEducation(i: number) { this.education.splice(i, 1); }

  // ── Experience helpers ────────────────────────────────────────────────────
  addExperience() {
    this.experience.push({ companyName: '', jobTitle: '', startDate: '', endDate: '', description: '' });
  }
  removeExperience(i: number) { this.experience.splice(i, 1); }

  // ── Project helpers ───────────────────────────────────────────────────────
  addProject() {
    this.projects.push({ name: '', description: '', repoUrl: '', liveUrl: '', technologies: '' });
  }
  removeProject(i: number) { this.projects.splice(i, 1); }

  // ── Certification helpers ─────────────────────────────────────────────────
  addCertification() {
    this.certifications.push({ name: '', issuingOrganization: '', issueDate: '', expirationDate: '', credentialUrl: '' });
  }
  removeCertification(i: number) { this.certifications.splice(i, 1); }

  // ── Resume upload (inline modal) ──────────────────────────────────────────
  openUploadModal(): void {
    this.uploadStep.set('select');
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.processingStage.set('Uploading resume...');
    this.processingEtaSecs.set(75);
    this.isUploadModalOpen.set(true);
  }

  closeUploadModal(): void {
    this.stopModalPoll();
    this.stopEta();
    this.isUploadModalOpen.set(false);
  }

  onResumeFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('File size exceeds 10 MB. Please upload a smaller PDF.');
      return;
    }
    this.startUpload(file);
  }

  private startUpload(file: File): void {
    this.uploadError.set(null);
    this.uploadStep.set('uploading');
    this.uploadProgress.set(5);
    this.processingStage.set('Uploading resume file...');

    this.profileService.uploadResume(file).subscribe({
      next: (res) => {
        this.uploadProgress.set(20);
        this.processingStage.set('Extracting text from PDF...');
        if (res.data?.id) this.resumeId.set(res.data.id);
        this.startPoll();
        this.startEta();
      },
      error: (err) => {
        this.uploadStep.set('error');
        this.uploadError.set(err.error?.message || 'Upload failed. Please try again.');
      }
    });
  }

  private startPoll(): void {
    this.stopModalPoll();
    let attempts = 0;
    this.modalPollId = setInterval(() => {
      attempts++;
      if (attempts === 3)  { this.processingStage.set('AI parsing skills & experience...'); this.uploadProgress.set(40); }
      if (attempts === 8)  { this.processingStage.set('Generating embedding vector...');     this.uploadProgress.set(60); }
      if (attempts === 15) { this.processingStage.set('Saving to database...');               this.uploadProgress.set(80); }

      if (attempts > 60) {
        this.stopModalPoll(); this.stopEta();
        this.uploadStep.set('error');
        this.uploadError.set('Processing timed out. Please try again with a different PDF.');
        return;
      }

      this.profileService.getLatestResume().subscribe({
        next: (res) => {
          if (res.data?.processingStatus === 'FAILED') {
            this.stopModalPoll(); this.stopEta();
            this.uploadStep.set('error');
            this.uploadError.set('AI could not parse your resume. Please use a text-based PDF (not scanned image).');
          } else if (res.data?.extractedJson) {
            this.stopModalPoll(); this.stopEta();
            this.uploadProgress.set(100);
            this.uploadStep.set('done');
            this.resumeStatus.set('SUCCESS');
            this.resumeUploadedAt.set(new Date().toISOString());
            // Reload profile from new extraction
            setTimeout(() => { this.closeUploadModal(); this.loadProfile(); }, 1500);
          }
        },
        error: () => {}
      });
    }, 3000);
  }

  private startEta(): void {
    this.stopEta();
    this.etaId = setInterval(() => this.processingEtaSecs.update(s => Math.max(0, s - 1)), 1000);
  }
  private stopModalPoll(): void { if (this.modalPollId) { clearInterval(this.modalPollId); this.modalPollId = null; } }
  private stopEta():       void { if (this.etaId)       { clearInterval(this.etaId);       this.etaId       = null; } }

  // ── Account actions ───────────────────────────────────────────────────────
  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onDeleteAccount(): void {
    // Placeholder — show confirmation dialog before real deletion
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      alert('Account deletion is not yet implemented. Please contact support.');
    }
  }

  onChangePassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  proficiencyLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
  workModes   = ['REMOTE', 'HYBRID', 'ONSITE'];
  genderOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
}
