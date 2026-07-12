import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  StaffUser, AppointmentStatus,
  AppointmentFormData, AppointmentFormMode, DoctorOption,
} from '../models';
import { AppointmentFormModal } from '../../components/appointment-form-modal/appointment-form-modal';
import { Sidebar } from '../../components/sidebar/sidebar';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';

export interface AgendaAppointment {
  id_cita: string;
  id_paciente: string;
  id_doctor: string;
  patient_name: string;
  doctor_name: string;
  scheduled_at: Date;
  status: AppointmentStatus;
  reason: string;
  notes: string;
  avatar_initials: string;
}

interface CalendarDay {
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  appointments: AgendaAppointment[];
}

const WEEK_DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTHS    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente', en_curso: 'En curso',
  completada: 'Completada', cancelada: 'Cancelada',
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

@Component({
  selector: 'app-agendar',
  imports: [CommonModule, RouterModule, Sidebar, AppointmentFormModal],
  templateUrl: './agendar.html',
  styleUrl: './agendar.css',
})
export class Agendar implements OnInit, OnDestroy {
  private auth  = inject(AuthService);
  private db    = inject(DatabaseService);
  private toast = inject(ToastService);

  private readonly emptyUser: StaffUser = { id_usuario: '', full_name: '', role: 'admin', email: '' };
  currentUser = computed(() => this.auth.staffProfile() ?? this.emptyUser);
  isDoctor    = computed(() => this.currentUser().role === 'doctor');
  isAdmin     = computed(() => this.currentUser().role === 'admin');

  sidebarOpen = false;
  readonly weekDays = WEEK_DAYS;

  doctors: DoctorOption[] = [];
  allAppointments  = signal<AgendaAppointment[]>([]);
  loading          = signal(false);
  error            = signal('');

  currentYM    = signal({ year: new Date().getFullYear(), month: new Date().getMonth() });
  selectedDate = signal<Date>(new Date());

  monthName = computed(() => MONTHS[this.currentYM().month]);

  filteredAppointments = computed(() => {
    const user = this.currentUser();
    if (!user) return this.allAppointments();
    return user.role === 'doctor'
      ? this.allAppointments().filter(a => a.id_doctor === user.id_usuario)
      : this.allAppointments();
  });

  calendarDays = computed((): CalendarDay[] => {
    const { year, month } = this.currentYM();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const firstDay    = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const days: CalendarDay[] = [];

    for (let i = startOffset; i > 0; i--) {
      const date = new Date(year, month, 1 - i);
      days.push({ date, dayNum: date.getDate(), isCurrentMonth: false, isToday: false, appointments: [] });
    }

    for (let n = 1; n <= daysInMonth; n++) {
      const date  = new Date(year, month, n);
      const isToday = isSameDay(date, today);
      const appointments = this.filteredAppointments().filter(a => isSameDay(a.scheduled_at, date));
      days.push({ date, dayNum: n, isCurrentMonth: true, isToday, appointments });
    }

    const remaining = 42 - days.length;
    for (let n = 1; n <= remaining; n++) {
      const date = new Date(year, month + 1, n);
      days.push({ date, dayNum: n, isCurrentMonth: false, isToday: false, appointments: [] });
    }

    return days;
  });

  isSelectedDayPast = computed(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sel   = new Date(this.selectedDate()); sel.setHours(0, 0, 0, 0);
    return sel < today;
  });

  selectedDayAppts = computed(() =>
    this.filteredAppointments()
      .filter(a => isSameDay(a.scheduled_at, this.selectedDate()))
      .sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime())
  );

  visualStatus(appt: AgendaAppointment): AppointmentStatus {
    if (this.isSelectedDayPast() && (appt.status === 'pendiente' || appt.status === 'en_curso')) {
      return 'completada';
    }
    return appt.status;
  }

  selectedDayLabel = computed(() => {
    const sel   = this.selectedDate();
    const today = new Date();
    if (isSameDay(sel, today)) return 'Hoy · ' + this.formatDateMedium(sel);
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    if (isSameDay(sel, tom)) return 'Mañana · ' + this.formatDateMedium(sel);
    return this.formatDateMedium(sel);
  });

  monthStats = computed(() => {
    const { year, month } = this.currentYM();
    const inMonth = this.filteredAppointments().filter(a =>
      a.scheduled_at.getFullYear() === year && a.scheduled_at.getMonth() === month
    );
    return {
      total:     inMonth.length,
      completed: inMonth.filter(a => a.status === 'completada').length,
      pending:   inMonth.filter(a => a.status === 'pendiente').length,
      active:    inMonth.filter(a => a.status === 'en_curso').length,
    };
  });

  private autoTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadMonth(), this.loadDoctors()]);
    this.autoTimer = setInterval(() => this.autoAdvanceStatus(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
  }

  private async autoAdvanceStatus(): Promise<void> {
    const now = new Date();
    const toAdvance = this.allAppointments()
      .filter(a => a.status === 'pendiente' && a.scheduled_at <= now);
    for (const appt of toAdvance) {
      try {
        await this.db.updateCita(appt.id_cita, { status: 'en_curso' });
        this.allAppointments.update(list =>
          list.map(a => a.id_cita === appt.id_cita ? { ...a, status: 'en_curso' as AppointmentStatus } : a)
        );
      } catch {}
    }
  }

  private async loadMonth(): Promise<void> {
    this.loading.set(true);
    const { year, month } = this.currentYM();
    const rows = await this.db.getCitasPorMes(year, month);
    this.allAppointments.set(rows.map(r => this.mapCita(r)));
    this.loading.set(false);
  }

  private async loadDoctors(): Promise<void> {
    this.doctors = await this.db.getDoctors();
  }

  private mapCita(r: any): AgendaAppointment {
    return {
      id_cita:         r.id_cita,
      id_paciente:     r.id_paciente,
      id_doctor:       r.id_doctor,
      patient_name:    r.patient_name,
      doctor_name:     r.doctor_name,
      scheduled_at:    new Date(r.scheduled_at),
      status:          r.status,
      reason:          r.reason,
      avatar_initials: r.patient_name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase(),
    };
  }

  async prevMonth(): Promise<void> {
    const { year, month } = this.currentYM();
    this.currentYM.set(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
    await this.loadMonth();
  }

  async nextMonth(): Promise<void> {
    const { year, month } = this.currentYM();
    this.currentYM.set(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
    await this.loadMonth();
  }

  async goToToday(): Promise<void> {
    const now = new Date();
    this.currentYM.set({ year: now.getFullYear(), month: now.getMonth() });
    this.selectedDate.set(now);
    this.dayPage = 1;
    await this.loadMonth();
  }

  selectDay(day: CalendarDay): void {
    this.selectedDate.set(day.date);
    this.dayPage = 1;
    const { year, month } = this.currentYM();
    if (day.date.getMonth() !== month || day.date.getFullYear() !== year) {
      this.currentYM.set({ year: day.date.getFullYear(), month: day.date.getMonth() });
    }
  }

  isSelectedDay(date: Date): boolean {
    return isSameDay(date, this.selectedDate());
  }

  readonly PAGE_SIZE = 25;
  dayPage = 1;

  dayTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.selectedDayAppts().length / this.PAGE_SIZE))
  );

  pagedDayAppts = computed(() => {
    const start = (this.dayPage - 1) * this.PAGE_SIZE;
    return this.selectedDayAppts().slice(start, start + this.PAGE_SIZE);
  });

  prevDayPage(): void { if (this.dayPage > 1) this.dayPage--; }
  nextDayPage(): void { if (this.dayPage < this.dayTotalPages()) this.dayPage++; }

  showAppointmentModal    = false;
  appointmentModalMode: AppointmentFormMode = 'create';
  editingAppointment: AppointmentFormData | null = null;

  openNewAppointment(): void {
    this.editingAppointment   = null;
    this.appointmentModalMode = 'create';
    this.showAppointmentModal = true;
  }

  openEditAppointment(appt: AgendaAppointment): void {
    const y   = appt.scheduled_at.getFullYear();
    const m   = String(appt.scheduled_at.getMonth() + 1).padStart(2, '0');
    const day = String(appt.scheduled_at.getDate()).padStart(2, '0');
    const h   = String(appt.scheduled_at.getHours()).padStart(2, '0');
    const min = String(appt.scheduled_at.getMinutes()).padStart(2, '0');

    this.editingAppointment = {
      id_cita:        appt.id_cita,
      id_paciente:    appt.id_paciente,
      patient_name:   appt.patient_name,
      id_doctor:      appt.id_doctor,
      scheduled_date: `${y}-${m}-${day}`,
      scheduled_time: `${h}:${min}`,
      reason:         appt.reason,
      notes:          '',
      status:         appt.status,
    };
    this.appointmentModalMode = 'edit';
    this.showAppointmentModal = true;
  }

  async onAppointmentSaved(data: AppointmentFormData): Promise<void> {
    try {
      const scheduledAt = new Date(`${data.scheduled_date}T${data.scheduled_time}:00`);
      const payload = {
        id_paciente:  data.id_paciente || null,
        id_doctor:    data.id_doctor || null,
        patient_name: data.patient_name,
        doctor_name:  this.doctors.find(d => d.id_usuario === data.id_doctor)?.full_name ?? '',
        scheduled_at: scheduledAt.toISOString(),
        reason:       data.reason,
        notes:        data.notes,
        status:       data.status,
      };

      if (data.id_cita) {
        await this.db.updateCita(data.id_cita, payload);
        this.allAppointments.update(list =>
          list.map(a => a.id_cita === data.id_cita
            ? { ...a, doctor_name: payload.doctor_name, scheduled_at: scheduledAt,
                reason: payload.reason, status: payload.status as AppointmentStatus }
            : a
          )
        );
        this.toast.success('Cita actualizada');
      } else {
        const created = await this.db.addCita(payload);
        if (created) this.allAppointments.update(list => [...list, this.mapCita(created)]);
        this.toast.success('Cita agendada correctamente');
      }
    } catch (err: any) {
      this.toast.error(err.message ?? 'Error al guardar cita.');
    }
    this.showAppointmentModal = false;
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDateMedium(date: Date): string {
    return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  getStatusLabel(status: AppointmentStatus): string { return STATUS_LABELS[status]; }
}
