import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeToggle } from '../../../components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-login-equipo',
  imports: [CommonModule, FormsModule, RouterModule, ThemeToggle],
  templateUrl: './login-equipo.html',
  styleUrl: './login-equipo.css',
})
export class LoginEquipo {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email    = '';
  password = '';
  showPwd  = false;

  loading = false;
  error   = '';

  showReset    = false;
  resetEmail   = '';
  resetSent    = false;
  resetLoading = false;

  async login(): Promise<void> {
    if (!this.email.trim() || !this.password) return;
    this.loading = true;
    this.error   = '';
    try {
      await this.auth.login(this.email.trim(), this.password);
      this.router.navigate(['/consultorio']);
    } catch (err: any) {
      this.error = err.message?.includes('Invalid login credentials')
        ? 'Correo o contraseña incorrectos.'
        : 'Error al iniciar sesión. Intenta de nuevo.';
    } finally {
      this.loading = false;
    }
  }

  async sendReset(): Promise<void> {
    if (!this.resetEmail.trim()) return;
    this.resetLoading = true;
    this.error        = '';
    try {
      await this.auth.resetPassword(this.resetEmail.trim());
      this.resetSent = true;
    } catch {
      this.error = 'No se pudo enviar el correo. Intenta de nuevo.';
    } finally {
      this.resetLoading = false;
    }
  }

  openReset(): void {
    this.showReset  = true;
    this.resetSent  = false;
    this.resetEmail = this.email;
    this.error      = '';
  }

  closeReset(): void {
    this.showReset  = false;
    this.resetSent  = false;
    this.resetEmail = '';
  }
}
