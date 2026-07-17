import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MatchResponse {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  compositeScore: number;
  eligibilityStatus: boolean;
  salaryRange?: string;
  jobType?: string;
}

export interface MatchDetailsResponse {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  location: string;
  jobDescription: string;
  jobRequirements?: string;
  compositeScore: number;
  eligibilityStatus: boolean;
  explanation?: string;
  skillGap?: string;
  careerInsights?: string;
  techFit?: number;
  projectFit?: number;
  expFit?: number;
  domainFit?: number;
  behavioralFit?: number;
  eduCertFit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class JobMatchesService {
  private readonly matchesUrl = 'http://localhost:8080/api/v1/matches';

  constructor(private readonly http: HttpClient) {}

  generateMatches(): Observable<any> {
    return this.http.post<any>(`${this.matchesUrl}/generate`, {});
  }

  getMatches(): Observable<any> {
    return this.http.get<any>(this.matchesUrl);
  }

  getMatchDetails(matchId: string): Observable<any> {
    return this.http.get<any>(`${this.matchesUrl}/${matchId}/details`);
  }

  searchMatches(params: any): Observable<any> {
    return this.http.get<any>(`${this.matchesUrl}/search`, { params });
  }

  askAi(matchId: string, question: string): Observable<any> {
    return this.http.post<any>(`${this.matchesUrl}/${matchId}/ask-ai`, { question });
  }
}
