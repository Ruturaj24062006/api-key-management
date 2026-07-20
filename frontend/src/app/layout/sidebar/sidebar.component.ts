import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'kf-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule, MatDividerModule],
  template: `
    <mat-nav-list class="kf-sidebar">
      @for (item of navItems; track item.route) {
        <a mat-list-item [routerLink]="item.route" routerLinkActive="kf-sidebar__item--active">
          <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
          <span matListItemTitle>{{ item.label }}</span>
        </a>
      }
      <mat-divider></mat-divider>
      <a mat-list-item routerLink="/audit-log" routerLinkActive="kf-sidebar__item--active">
        <mat-icon matListItemIcon>history</mat-icon>
        <span matListItemTitle>Audit Log</span>
      </a>
    </mat-nav-list>
  `,
  styles: [`
    .kf-sidebar {
      padding-top: 8px;
    }

    .kf-sidebar__item--active {
      background-color: rgba(63, 81, 181, 0.08);
      font-weight: 600;
    }
  `],
})
export class SidebarComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Projects', icon: 'folder', route: '/projects' },
  ];
}
