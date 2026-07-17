import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminStats {
  studentCount: number;
  recruiterCount: number;
  companyCount: number;
  jobCount: number;
  applicationCount: number;
}

export interface AdminStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  suspended: boolean;
}

export interface AdminRecruiter {
  id: string;
  email: string;
  jobTitle: string;
  companyName: string;
  suspended: boolean;
  verified: boolean;
}

export interface AdminCompany {
  id: string;
  name: string;
  industry: string;
  location: string;
  websiteUrl: string;
  verified: boolean;
}

export interface AdminJob {
  id: string;
  title: string;
  companyName: string;
  workMode: string;
  location: string;
  status: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly adminUrl = 'http://localhost:8080/api/v1/admin';

  constructor(private readonly http: HttpClient) {}

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/stats`);
  }

  getStudents(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/students`);
  }

  getRecruiters(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/recruiters`);
  }

  toggleSuspension(userId: string): Observable<any> {
    return this.http.put<any>(`${this.adminUrl}/users/${userId}/suspend`, {});
  }

  getCompanies(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/companies`);
  }

  verifyCompany(companyId: string): Observable<any> {
    return this.http.put<any>(`${this.adminUrl}/companies/${companyId}/verify`, {});
  }

  getJobs(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/jobs`);
  }

  deleteJob(jobId: string): Observable<any> {
    return this.http.delete<any>(`${this.adminUrl}/jobs/${jobId}`);
  }
}
