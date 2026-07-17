import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SkillDto {
  name: string;
  proficiencyLevel: string;
}

export interface EducationDto {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  gpa?: number;
}

export interface ExperienceDto {
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface ProjectDto {
  name: string;
  description?: string;
  repoUrl?: string;
  technologies?: string;
}

export interface StudentProfileDto {
  firstName: string;
  lastName: string;
  bio?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  careerPreferences?: string;
  languages?: string;
  profileCompletedPct: number;
  skills: SkillDto[];
  projects: ProjectDto[];
  experience: ExperienceDto[];
  education: EducationDto[];
}

@Injectable({
  providedIn: 'root'
})
export class StudentProfileService {
  private readonly studentsUrl = 'http://localhost:8080/api/v1/students';
  private readonly resumeUrl = 'http://localhost:8080/api/v1/resume';

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.studentsUrl}/profile`);
  }

  updateProfile(profile: StudentProfileDto): Observable<any> {
    return this.http.put<any>(`${this.studentsUrl}/profile`, profile);
  }

  getProfileById(studentId: string): Observable<any> {
    return this.http.get<any>(`${this.studentsUrl}/${studentId}`);
  }

  uploadResume(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.resumeUrl}/upload`, formData);
  }

  getLatestResume(): Observable<any> {
    return this.http.get<any>(`${this.resumeUrl}/latest`);
  }

  confirmResume(resumeId: string): Observable<any> {
    return this.http.post<any>(`${this.resumeUrl}/${resumeId}/confirm`, {});
  }
}
