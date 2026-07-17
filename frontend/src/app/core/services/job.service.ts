import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface JobCreateDto {
  title: string;
  description: string;
  requirements?: string;
  location?: string;
  jobType: string;
  experienceLevel?: string;
  salaryRange?: string;
  requiredSkills?: string;
  preferredSkills?: string;
  workMode?: string;
  educationLevel?: string;
  sponsorshipAvailable?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private readonly jobsUrl = 'http://localhost:8080/api/v1/jobs';

  constructor(private readonly http: HttpClient) {}

  createJob(job: JobCreateDto): Observable<any> {
    return this.http.post<any>(this.jobsUrl, job);
  }

  getMyJobs(): Observable<any> {
    return this.http.get<any>(`${this.jobsUrl}/my`);
  }

  updateJob(jobId: string, job: JobCreateDto): Observable<any> {
    return this.http.put<any>(`${this.jobsUrl}/${jobId}`, job);
  }

  updateJobStatus(jobId: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.jobsUrl}/${jobId}/status`, { status });
  }

  deleteJob(jobId: string): Observable<any> {
    return this.http.delete<any>(`${this.jobsUrl}/${jobId}`);
  }

  aiAssist(prompt: string): Observable<any> {
    return this.http.post<any>(`${this.jobsUrl}/ai-assist`, { prompt });
  }
}

