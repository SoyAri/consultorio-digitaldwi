import { Component } from '@angular/core';

// =============================================================================
// [TODO-SEGURIDAD] RESPONSABILIDAD: COMPAÑERO PORTAL
// Alcance: este archivo y consulta-detalle.html.
// NO tocar login-paciente.ts ni login-paciente.html — son responsabilidad de otro compañero.
//
// DEPENDE DE: OTP implementado en login-paciente.ts.
//   sessionStorage 'patient_session' = { id_paciente: string, phone: string }
//
// COMPONENTE A IMPLEMENTAR — DETALLE DE CONSULTA MÉDICA
// =============================================================================
//
// Ruta: /portal/consultas/:idConsulta
//
// SEGURIDAD CRÍTICA:
//   Un paciente NO debe poder ver consultas de otro cambiando el :idConsulta en la URL.
//   La defensa principal es el doble filtro en la query de Supabase (ver paso 5).
//
// ── DEPENDENCIAS A INYECTAR ───────────────────────────────────────────────
//
//   import { ActivatedRoute } from '@angular/router';
//   import { Router } from '@angular/router';
//   import { SupabaseService } from '../../services/supabase.service';
//   import { signal } from '@angular/core';
//
//   private route    = inject(ActivatedRoute);
//   private router   = inject(Router);
//   private supabase = inject(SupabaseService).client;
//
// ── INTERFACE SUGERIDA ────────────────────────────────────────────────────
//
//   interface ConsultaDetalleData {
//     id_historial: string;
//     visit_date: string;
//     chief_complaint: string;
//     diagnosis: string;
//     treatment: string;
//     observations: string;
//     prescriptions: { medicine: string; dosage: string; frequency: string; duration: string }[];
//     next_visit_date: string | null;
//     doctor_name: string;
//   }
//
//   consulta = signal<ConsultaDetalleData | null>(null);
//   loading  = signal(true);
//
// ── IMPLEMENTAR ngOnInit() — en este orden exacto ─────────────────────────
//
//   1. VERIFICAR SESIÓN SUPABASE AUTH:
//        const { data: { session } } = await this.supabase.auth.getSession();
//        if (!session) {
//          sessionStorage.removeItem('patient_session');
//          this.router.navigate(['/login/paciente']);
//          return;
//        }
//
//   2. LEER patient_session de sessionStorage:
//        const sessionStr = sessionStorage.getItem('patient_session');
//        if (!sessionStr) { this.router.navigate(['/login/paciente']); return; }
//        const { id_paciente, phone } = JSON.parse(sessionStr) as { id_paciente: string; phone: string };
//
//   3. VERIFICAR que el phone del JWT coincide con sessionStorage:
//      (Protege contra manipulación del sessionStorage desde DevTools)
//        if (session.user.phone !== '+52' + phone) {
//          sessionStorage.removeItem('patient_session');
//          await this.supabase.auth.signOut();
//          this.router.navigate(['/login/paciente']);
//          return;
//        }
//
//   4. LEER PARÁMETRO DE RUTA:
//        const idConsulta = this.route.snapshot.paramMap.get('idConsulta');
//        if (!idConsulta) { this.router.navigate(['/portal']); return; }
//
//   5. QUERY CON DOBLE FILTRO DE SEGURIDAD (ownership check):
//        const { data, error } = await this.supabase
//          .from('consultas')
//          .select('id_historial, visit_date, chief_complaint, diagnosis, treatment, observations, prescriptions, next_visit_date, doctor_name')
//          .eq('id_historial', idConsulta)    // ← filtra la consulta de la URL
//          .eq('id_paciente', id_paciente)    // ← CRÍTICO: verifica ownership del paciente
//          .single();
//
//   6. MANEJAR RESULTADO:
//        if (error || !data) {
//          // Redirigir a /portal SIN distinguir "no encontrado" de "sin acceso".
//          // ANTI-ENUMERACIÓN: no revelar si la consulta existe pero no le pertenece.
//          this.router.navigate(['/portal']);
//          return;
//        }
//        this.consulta.set(data);
//        this.loading.set(false);
//
// ── NOTA SOBRE RLS ────────────────────────────────────────────────────────
//
//   Las políticas RLS actuales (supabase/migrations/20260616_init_schema.sql)
//   solo cubren acceso de staff autenticado. El doble filtro en el query es la
//   única defensa actualmente para el acceso de pacientes. En el futuro se puede
//   agregar una política RLS específica para pacientes usando el JWT de Supabase Auth.
//
// =============================================================================

@Component({
  selector: 'app-consulta-detalle',
  imports: [],
  templateUrl: './consulta-detalle.html',
  styleUrl: './consulta-detalle.css',
})
export class ConsultaDetalle {}
