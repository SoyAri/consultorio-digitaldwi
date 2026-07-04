import { Component, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';

// =============================================================================
// [TODO-SEGURIDAD] RESPONSABILIDAD: COMPAÑERO OTP
// Alcance: SOLO este archivo (login-paciente.ts) y login-paciente.html.
// NO tocar portal.ts, auth.guard.ts ni consulta-detalle.ts —
// esos archivos son responsabilidad de otro compañero (ver sus propios comentarios).
//
// CONFIGURACIÓN: Phone Auth con Twilio ya está habilitado en el Supabase Dashboard.
//   Solo falta implementar el código — no hay configuración adicional pendiente.
//   Para usar el cliente de Supabase inyectar: inject(SupabaseService).client
//   (SupabaseService está en src/app/services/supabase.service.ts)
//
// CONTRATO DE ENTREGA (lo que el portal espera encontrar al redirigir a /portal):
//   sessionStorage key 'patient_session' con:
//     { id_paciente: string, phone: string }
//   (solo estos dos campos — sin full_name ni otros datos PII)
//
// ── PASO 1: sendOtp() ──────────────────────────────────────────────────────
//
//   IMPLEMENTAR:
//     const { error } = await supabase.auth.signInWithOtp({
//       phone: '+52' + digits,
//       options: { channel: 'sms' },
//     });
//
//   SEGURIDAD — ANTI-ENUMERACIÓN DE CUENTAS:
//     NO buscar el paciente en la tabla `pacientes` en este paso.
//     NO verificar si el número existe o no.
//     Siempre mostrar el MISMO mensaje neutro sin importar el resultado:
//       "Si ese número está registrado, recibirás un código por SMS."
//     Esto evita que un atacante descubra qué números tienen cuenta registrada.
//
//   NO guardar nada en sessionStorage aquí.
//   NO guardar foundPatient. NO mostrar el nombre del paciente.
//
// ── PASO 2: verifyOtp() ────────────────────────────────────────────────────
//
//   IMPLEMENTAR (en este orden exacto):
//
//   1. Verificar el OTP con Supabase Auth:
//        const { error } = await supabase.auth.verifyOtp({
//          phone: '+52' + this.phone.replace(/\D/g, ''),
//          token: this.otp,
//          type: 'sms',
//        });
//        if (error) throw error;  → mostrar "Código incorrecto o expirado." (genérico)
//
//   2. OTP válido → verificar que está registrado como paciente:
//        const digits = this.phone.replace(/\D/g, '');
//        const patient = await this.db.getPacienteByPhone(digits);
//        if (!patient) {
//          await supabase.auth.signOut();
//          // Error genérico — no revelar que el número no existe en pacientes.
//          throw new Error('No se pudo completar el acceso.');
//        }
//
//   3. Guardar sesión (SOLO aquí, después del OTP exitoso):
//        sessionStorage.setItem('patient_session', JSON.stringify({
//          id_paciente: (patient as any).id_paciente,
//          phone: digits,
//          // NO incluir full_name ni otros datos — el portal los carga desde la DB
//        }));
//
//   4. navigate(['/portal'])
//
// ── PASO 3: resend() ───────────────────────────────────────────────────────
//
//   IMPLEMENTAR:
//     await supabase.auth.signInWithOtp({
//       phone: '+52' + this.phone.replace(/\D/g, ''),
//       options: { channel: 'sms' },
//     });
//
// ── HTML: login-paciente.html ─────────────────────────────────────────────
//
//   Ver comentarios [TODO-SEGURIDAD] en login-paciente.html.
//   Resumen: cambiar el saludo "¡Hola, {{ firstNamePatient }}!" por texto neutro.
//
// =============================================================================

type LoginStep = 'phone' | 'otp';

interface PatientSession {
  id_paciente: string;
  full_name: string;
  phone: string;
}

// Helper para evitar que las llamadas de red queden colgadas indefinidamente
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timeoutPromise]);
}

@Component({
  selector: 'app-login-paciente',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login-paciente.html',
  styleUrl: './login-paciente.css',
})
export class LoginPaciente implements OnDestroy {
  private db              = inject(DatabaseService);
  private router          = inject(Router);
  private supabaseService = inject(SupabaseService);
  private supabase        = this.supabaseService.client;
  private cdr             = inject(ChangeDetectorRef);

  step: LoginStep = 'phone';

  phone = '';
  otp   = '';

  foundPatient: PatientSession | null = null;
  loading        = false;
  error          = '';
  resendCooldown = 0;

  // TEMPORAL - DEV ONLY: controla la visibilidad del botón que salta la
  // espera de Twilio usando el número/código de prueba de Supabase.
  showDevBypass = !environment.production && environment.otpBypass;

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  async sendOtp(): Promise<void> {
    const digits = this.phone.replace(/\D/g, '');
    if (digits.length !== 10) return;
    this.loading = true;
    this.error   = '';

    try {
      // 1. Solicitar OTP con timeout de 8 segundos para evitar que la UI se cuelgue si la red es inestable
      await withTimeout(
        this.supabase.auth.signInWithOtp({
          phone: '+52' + digits,
          options: { channel: 'sms' }
        }),
        8000,
        'Tiempo de espera agotado al conectar con Supabase.'
      );
      
      // 2. Siempre avanzar al paso OTP (medida de seguridad: anti-enumeración de cuentas)
      this.step = 'otp';
      this.startCooldown();
    } catch (err: any) {
      console.error('Error en sendOtp:', err);
      // Avanzamos de todas formas para no dar pistas al atacante de que el número no existe,
      // pero si el error fue un timeout o error de red real, también avanzamos para intentar verificar
      this.step = 'otp';
      this.startCooldown();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async verifyOtp(): Promise<void> {
    if (this.otp.length !== 6) return;
    this.loading = true;
    this.error   = '';
    try {
      const digits = this.phone.replace(/\D/g, '');

      // 1. Verificar el OTP con Supabase Auth con timeout de 8 segundos
      const result = await withTimeout(
        this.supabase.auth.verifyOtp({
          phone: '+52' + digits,
          token: this.otp,
          type: 'sms',
        }),
        8000,
        'Tiempo de espera agotado al verificar el código.'
      );

      if (result.error) {
        throw new Error('Código incorrecto o expirado.');
      }

      // 2. OTP válido → verificar que está registrado como paciente
      const patient = await this.db.getPacienteByPhone(digits);
      if (!patient) {
        await this.supabase.auth.signOut();
        // Error genérico — no revelar que el número no existe en pacientes
        throw new Error('No se pudo completar el acceso.');
      }

      // 3. Guardar sesión (SOLO aquí, después del OTP exitoso)
      sessionStorage.setItem('patient_session', JSON.stringify({
        id_paciente: (patient as any).id_paciente,
        phone: digits,
      }));

      // 4. Navegar al portal
      this.router.navigate(['/portal']);
    } catch (err: any) {
      console.error('Error en verifyOtp:', err);
      this.error = err.message || 'Código incorrecto o expirado. Intenta de nuevo.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async resend(): Promise<void> {
    if (this.resendCooldown > 0) return;
    this.otp   = '';
    this.error = '';
    const digits = this.phone.replace(/\D/g, '');
    try {
      await withTimeout(
        this.supabase.auth.signInWithOtp({
          phone: '+52' + digits,
          options: { channel: 'sms' }
        }),
        8000,
        'Tiempo de espera agotado.'
      );
    } catch (err) {
      console.error('Error al reenviar OTP:', err);
    }
    
    // IMPORTANTE: NO eliminar el startCooldown
    this.startCooldown();
    this.cdr.detectChanges();
  }

  // TEMPORAL - DEV ONLY: usa el número/código de prueba configurado en
  // Supabase (Test Phone Numbers) para saltar la espera de Twilio en
  // desarrollo. Reutiliza sendOtp()/verifyOtp() sin modificarlos.
  async devSkipOtp(): Promise<void> {
    if (!this.showDevBypass) return;
    this.phone = environment.otpBypassPhone;
    await this.sendOtp();
    this.otp = environment.otpBypassCode;
    await this.verifyOtp();
  }

  back(): void {
    this.step         = 'phone';
    this.otp          = '';
    this.error        = '';
    this.foundPatient = null;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.resendCooldown = 0;
  }

  onOtpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.otp    = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = this.otp;
    if (this.otp.length === 6) this.verifyOtp();
  }

  onPhoneInput(event: Event): void {
    const input  = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    this.phone   = digits;
    input.value  = digits;
  }

  get formattedPhone(): string {
    const d = this.phone.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    return this.phone;
  }

  // [TODO-SEGURIDAD] NO usar este getter en el HTML del paso OTP.
  // Mostrar el nombre antes de verificar el OTP revela que ese número existe
  // en el sistema → enumeración de cuentas (account enumeration).
  // Ver comentario en login-paciente.html para el cambio concreto en la UI.
  get firstNamePatient(): string {
    return this.foundPatient?.full_name.split(' ')[0] ?? '';
  }

  private startCooldown(): void {
    this.resendCooldown = 30;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0 && this.cooldownTimer) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }
}
