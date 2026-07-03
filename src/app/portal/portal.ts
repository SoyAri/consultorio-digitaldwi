import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

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
// [TODO-SEGURIDAD] Actualizar esta interfaz cuando el OTP esté listo:
// Eliminar full_name — sessionStorage ya no lo guarda (evitar PII en cliente).
// Cargar el nombre del paciente desde la DB con getPacienteById(id_paciente).
interface PatientSession {
  id_paciente: string;
  full_name: string; // [TODO-SEGURIDAD] Eliminar tras implementar OTP real — no guardar PII en sesión
  phone: string;
}

@Component({
  selector: 'app-portal',
  imports: [CommonModule, RouterModule],
  templateUrl: './portal.html',
  styleUrl: './portal.css',
})
export class Portal implements OnInit {
  private supabase = inject(SupabaseService).client;
  private router   = inject(Router);

  patient       = signal<PatientSession | null>(null);
  appointments  = signal<any[]>([]);
  consultations = signal<any[]>([]);
  loading       = signal(true);
  error         = signal('');

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

    await this.loadData(patient.id_paciente);
    this.loading.set(false);
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
    return this.patient()?.full_name.split(' ')[0] ?? '';
  }
}
