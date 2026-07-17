import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class JobApplicationsService {
  private readonly applicationsUrl = 'http://localhost:8080/api/v1/applications';

  constructor(private readonly http: HttpClient) {}

  applyToJob(jobId: string, coverLetter: string): Observable<any> {
    return this.http.post<any>(`${this.applicationsUrl}/apply/${jobId}`, { coverLetter });
  }

  getMyApplications(): Observable<any> {
    return this.http.get<any>(`${this.applicationsUrl}/my`);
  }

  getJobApplications(jobId: string): Observable<any> {
    return this.http.get<any>(`${this.applicationsUrl}/job/${jobId}`);
  }

  updateStatus(applicationId: string, status: string, feedback: string): Observable<any> {
    return this.http.put<any>(`${this.applicationsUrl}/${applicationId}/status`, { status, feedback });
  }

  respondToInterview(applicationId: string, response: string, note: string): Observable<any> {
    return this.http.put<any>(`${this.applicationsUrl}/${applicationId}/respond`, { response, note });
  }
}

