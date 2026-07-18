import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DoctorDateSlotPicker, BookingConfirmPayload } from '../../../components/doctor-date-slot-picker/doctor-date-slot-picker';
import { DatabaseService } from '../../services/database.service';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { DoctorOption, BookAppointmentResponse } from '../../models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-agendar-cita',
  imports: [CommonModule, RouterModule, DoctorDateSlotPicker],
  templateUrl: './agendar-cita.html',
  styleUrl: './agendar-cita.css',
})
export class AgendarCita implements OnInit {
  private db       = inject(DatabaseService);
  private supabase = inject(SupabaseService).client;
  private toast    = inject(ToastService);
  private router   = inject(Router);

  doctors           = signal<DoctorOption[]>([]);
  availableSlots    = signal<string[]>([]);
  loadingSlots      = signal(false);
  submitting        = signal(false);
  errorMessage      = signal('');
  loadingDoctor     = signal(true);
  noAssignedDoctor  = signal(false);

  private currentDoctorId = '';
  private currentDate     = '';

  // El auto-agendamiento no es un directorio abierto: el paciente solo puede
  // agendar con el doctor que ya tiene asignado en su expediente (continuidad
  // de atención). El Edge Function vuelve a validar esto del lado servidor —
  // esto es solo para no mostrarle en la UI opciones que igual serían rechazadas.
  async ngOnInit(): Promise<void> {
    this.loadingDoctor.set(true);
    try {
      const patientId = this.readPatientIdFromSession();
      const paciente = patientId ? await this.db.getPacienteById(patientId) : null;

      if (!paciente?.assigned_doctor_id) {
        this.noAssignedDoctor.set(true);
        return;
      }

      const doctor = await this.db.getStaffById(paciente.assigned_doctor_id);
      if (!doctor) {
        this.noAssignedDoctor.set(true);
        return;
      }

      this.doctors.set([{ id_usuario: doctor.id_usuario, full_name: doctor.full_name, specialty: doctor.specialty ?? '' }]);
    } finally {
      this.loadingDoctor.set(false);
    }
  }

  async onDoctorChange(doctorId: string): Promise<void> {
    this.currentDoctorId = doctorId;
    await this.refreshSlots();
  }

  async onDateChange(date: string): Promise<void> {
    this.currentDate = date;
    await this.refreshSlots();
  }

  private async refreshSlots(): Promise<void> {
    if (!this.currentDoctorId || !this.currentDate) return;
    this.loadingSlots.set(true);
    this.errorMessage.set('');
    try {
      const slots = await this.db.getAvailableSlots(this.currentDoctorId, this.currentDate);
      this.availableSlots.set(slots);
    } catch {
      this.errorMessage.set('No se pudieron cargar los horarios disponibles.');
    } finally {
      this.loadingSlots.set(false);
    }
  }

  async onConfirm(payload: BookingConfirmPayload): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

      const res = await fetch(`${environment.supabase.url}/functions/v1/book-appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          // Solo referencia UX — el Edge Function re-verifica la identidad
          // del paciente por el teléfono del JWT, nunca confía en este campo.
          id_paciente: this.readPatientIdFromSession(),
          id_doctor:   payload.doctorId,
          date:        payload.date,
          time:        payload.time,
          reason:      payload.reason,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          this.toast.error(body.error ?? 'Ese horario ya no está disponible, elige otro.');
          await this.refreshSlots();
          return;
        }
        throw new Error(body.error ?? 'No se pudo agendar la cita.');
      }

      const cita = body as BookAppointmentResponse;
      this.toast.success(`Cita agendada con ${cita.doctor_name}`);
      this.router.navigate(['/portal']);
    } catch (err: any) {
      this.toast.error(err.message ?? 'No se pudo agendar la cita.');
    } finally {
      this.submitting.set(false);
    }
  }

  // Lectura de conveniencia para prellenar el request — nunca es la fuente de
  // verdad de identidad (eso lo resuelve el Edge Function con el JWT). No
  // depende de ninguna lógica de portal.ts, solo lee la misma llave de sesión.
  private readPatientIdFromSession(): string {
    try {
      const raw = sessionStorage.getItem('patient_session');
      if (!raw) return '';
      return JSON.parse(raw).id_paciente ?? '';
    } catch {
      return '';
    }
  }
}
