import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notificationsUrl = 'http://localhost:8080/api/v1/notifications';

  constructor(private readonly http: HttpClient) {}

  getMyNotifications(): Observable<any> {
    return this.http.get<any>(this.notificationsUrl);
  }

  markAsRead(id: string): Observable<any> {
    return this.http.put<any>(`${this.notificationsUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.put<any>(`${this.notificationsUrl}/read-all`, {});
  }
}
