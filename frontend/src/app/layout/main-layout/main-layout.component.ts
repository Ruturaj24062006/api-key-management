import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { OrganizationService } from '../../core/services/organization.service';

@Component({
  selector: 'kf-main-layout',
  standalone: true,
  imports: [RouterOutlet, MatSidenavModule, TopbarComponent, SidebarComponent],
  template: `
    <kf-topbar (menuToggle)="sidenavOpen.set(!sidenavOpen())"></kf-topbar>
    <mat-sidenav-container class="kf-shell">
      <mat-sidenav mode="side" [opened]="sidenavOpen()" class="kf-shell__sidenav">
        <kf-sidebar></kf-sidebar>
      </mat-sidenav>
      <mat-sidenav-content class="kf-shell__content">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .kf-shell {
      height: calc(100vh - 64px);
    }

    .kf-shell__sidenav {
      width: 240px;
      border-right: 1px solid rgba(0, 0, 0, 0.08);
    }

    .kf-shell__content {
      background-color: #f5f6f8;
    }
  `],
})
export class MainLayoutComponent implements OnInit {
  private readonly organizationService = inject(OrganizationService);

  sidenavOpen = signal(true);

  ngOnInit(): void {
    this.organizationService.list().subscribe();
  }
}
