import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecruiterProfileDto {
  id?: string;
  email?: string;
  jobTitle?: string;
  isVerified?: boolean;
  companyId?: string;
  companyName?: string;
  logoUrl?: string;
  websiteUrl?: string;
  industry?: string;
  location?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecruiterProfileService {
  private readonly recruitersUrl = 'http://localhost:8080/api/v1/recruiters';

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.recruitersUrl}/profile`);
  }

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.recruitersUrl}/stats`);
  }

  onboard(profile: RecruiterProfileDto): Observable<any> {
    return this.http.post<any>(`${this.recruitersUrl}/onboard`, profile);
  }

  verify(): Observable<any> {
    return this.http.post<any>(`${this.recruitersUrl}/verify`, {});
  }
}
