import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { DatabaseService } from '../services/database.service';

// =============================================================================
// [TODO-SEGURIDAD] RESPONSABILIDAD: COMPAÑERO PORTAL
// Alcance: portal.ts, portal.html, auth.guard.ts y consulta-detalle.ts.
// NO tocar login-paciente.ts ni login-paciente.html — son responsabilidad de otro compañero.
//
// DEPENDE DE: Que el OTP esté implementado en login-paciente.ts.
//   Al completar la verificación OTP exitosamente, sessionStorage tendrá:
//     'patient_session' = { id_paciente: string, phone: string }
//   (sin full_name — cargarlo desde la DB usando getPacienteById o getPacienteByPhone)
// =============================================================================
//
interface PatientSession {
  id_paciente: string;
  phone: string;
}

@Component({
  selector: 'app-portal',
  imports: [CommonModule, RouterModule],
  templateUrl: './portal.html',
  styleUrl: './portal.css',
})
export class Portal implements OnInit,  OnDestroy {
  private supabase = inject(SupabaseService).client;
  private router   = inject(Router);
  private db       = inject(DatabaseService);

  patient       = signal<PatientSession | null>(null);
  patientName   = signal('');
  appointments  = signal<any[]>([]);
  consultations = signal<any[]>([]);
  loading       = signal(true);
  error         = signal('');
  private inactivityTimer: any;
  private warningTimer: any;
  readonly INACTIVITY_LIMIT = 5* 60 * 1000; // 5 minutos
  readonly WARNING_TIME = 30 * 1000; // aviso 30 segundos antes
  showInactivityWarning = signal(false);

    ngOnDestroy(): void {
    clearTimeout(this.inactivityTimer);
    clearTimeout(this.warningTimer);
  }

  async ngOnInit(): Promise<void> {
    // [TODO-SEGURIDAD] VERIFICACIÓN EN DOS CAPAS — reemplazar el bloque siguiente:
    //
    // CAPA 1 — Verificar sesión de Supabase Auth (no confiar solo en sessionStorage):
    //   const { data: { session } } = await this.supabase.auth.getSession();
    //   if (!session) {
    //     sessionStorage.removeItem('patient_session');
    //     this.router.navigate(['/login/paciente']);
    //     return;
    //   }
    //
    // CAPA 2 — Verificar que el phone del JWT coincide con el de sessionStorage:
    //   const sessionStr = sessionStorage.getItem('patient_session');
    //   if (!sessionStr) { this.router.navigate(['/login/paciente']); return; }
    //   const parsed = JSON.parse(sessionStr) as PatientSession;
    //   if (session.user.phone !== '+52' + parsed.phone) {
    //     sessionStorage.removeItem('patient_session');
    //     await this.supabase.auth.signOut();
    //     this.router.navigate(['/login/paciente']);
    //     return;
    //   }
    //   // Si pasa ambas capas, continuar con los datos del paciente.
    //
    // Por qué ambas capas: sessionStorage puede ser manipulado desde DevTools.
    // El JWT de Supabase Auth es la fuente de verdad — el phone ahí no se puede falsificar.
    //
    // ───────────────────────────── INICIO BLOQUE ACTUAL (reemplazar con lo de arriba) ──
    const sessionStr = sessionStorage.getItem('patient_session');
    if (!sessionStr) {
      this.router.navigate(['/login/paciente']);
      return;
    }

    const patient = JSON.parse(sessionStr) as PatientSession;
    this.patient.set(patient);

    const [pacienteDetail] = await Promise.all([
      this.db.getPacienteById(patient.id_paciente),
      this.loadData(patient.id_paciente),
    ]);
    this.patientName.set(pacienteDetail?.full_name ?? '');
    this.loading.set(false);
    ['mousemove','keydown','click','scroll'].forEach(event =>
    document.addEventListener(event, () => this.resetInactivityTimer())
  );
  this.resetInactivityTimer();
    // ─────────────────────────────────────────────────────── FIN BLOQUE ACTUAL ──
  }

  private async loadData(pacienteId: string): Promise<void> {
    const now = new Date().toISOString();

    // [TODO-SEGURIDAD] OWNERSHIP — CRÍTICO: los filtros .eq('id_paciente', pacienteId)
    // son la línea de defensa principal contra que un paciente vea datos de otro.
    // NUNCA eliminar esos filtros. Si se agregan nuevas queries a este componente,
    // SIEMPRE filtrar por el id_paciente que viene de la sesión verificada.
    // Nunca usar parámetros de la URL para determinar qué paciente mostrar.
    const [citasRes, consultasRes] = await Promise.all([
      this.supabase
        .from('citas')
        .select('id_cita, doctor_name, scheduled_at, reason, status')
        .eq('id_paciente', pacienteId)
        .gte('scheduled_at', now)
        .order('scheduled_at')
        .limit(10),
      this.supabase
        .from('consultas')
        .select('id_historial, doctor_name, visit_date, chief_complaint, diagnosis, prescriptions')
        .eq('id_paciente', pacienteId)
        .order('visit_date', { ascending: false })
        .limit(10),
    ]);

    if (citasRes.error)    this.error.set('Error al cargar citas.');
    if (consultasRes.error) this.error.set('Error al cargar historial.');

    this.appointments.set(citasRes.data ?? []);
    this.consultations.set(consultasRes.data ?? []);
  }

    private resetInactivityTimer(): void {
    clearTimeout(this.inactivityTimer);
    clearTimeout(this.warningTimer);
    this.showInactivityWarning.set(false);

    this.warningTimer = setTimeout(() => {
      this.showInactivityWarning.set(true);
    }, this.INACTIVITY_LIMIT - this.WARNING_TIME);

    this.inactivityTimer = setTimeout(() => {
      this.logout();
    }, this.INACTIVITY_LIMIT);
  }

  extendSession(): void {
    this.resetInactivityTimer();
  }

      verDetalleCita(id: string): void {
    this.router.navigate(['/portal/consultas', id]);
  }

    verDetalleConsulta(id: string): void {
    this.router.navigate(['/portal/consultas', id]);
  }

  logout(): void {
    // [TODO-SEGURIDAD] Agregar supabase.auth.signOut() para cerrar también la sesión JWT.
    // Sin esto, el token de Supabase Auth permanece válido aunque el usuario haga logout.
    // Ejemplo: await this.supabase.auth.signOut();
    sessionStorage.removeItem('patient_session');
    this.router.navigate(['/login/paciente']);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente', en_curso: 'En curso',
      completada: 'Completada', cancelada: 'Cancelada',
    };
    return labels[status] ?? status;
  }

  get firstName(): string {
    return this.patientName().split(' ')[0] ?? '';
  }
}
