import { Component, Input, Output, EventEmitter, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../app/services/auth.service';
import { StaffUser } from '../../app/models';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, RouterLinkActive, ThemeToggle],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private auth   = inject(AuthService);
  private router = inject(Router);

  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();

  private readonly emptyUser: StaffUser = { id_usuario: '', full_name: '', role: 'admin', email: '' };
  currentUser = computed(() => this.auth.staffProfile() ?? this.emptyUser);
  isDoctor    = computed(() => this.currentUser().role === 'doctor');
  isAdmin     = computed(() => this.currentUser().role === 'admin');

  get initials(): string {
    return this.currentUser().full_name
      .split(' ').slice(0, 2).map(n => n[0] ?? '').join('');
  }

  get roleLabel(): string {
    const u = this.currentUser();
    if (u.role === 'doctor') return (u as any).specialty ?? 'Doctor';
    return 'Secretaria/o';
  }

  close(): void {
    this.openChange.emit(false);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login/equipo']);
  }
}