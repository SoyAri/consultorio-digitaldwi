import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StaffUser, UserRole, StaffFormMode, StaffFormData, DoctorSchedule } from '../models';
import { StaffFormModal } from '../../components/staff-form-modal/staff-form-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal/reset-password-modal';
import { Sidebar } from '../../components/sidebar/sidebar';
import { WeeklyScheduleGrid } from '../../components/weekly-schedule-grid/weekly-schedule-grid';
import { ScheduleFormModal, ScheduleFormMode } from '../../components/schedule-form-modal/schedule-form-modal';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import { SupabaseService } from '../services/supabase.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-configuracion',
  imports: [CommonModule, RouterModule, Sidebar, StaffFormModal, ResetPasswordModal, WeeklyScheduleGrid, ScheduleFormModal],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
})
export class Configuracion implements OnInit {
  private auth     = inject(AuthService);
  private db       = inject(DatabaseService);
  private supabase = inject(SupabaseService).client;
  private toast    = inject(ToastService);

  private readonly emptyUser: StaffUser = { id_usuario: '', full_name: '', role: 'admin', email: '' };
  currentUser = computed(() => this.auth.staffProfile() ?? this.emptyUser);
  isDoctor    = computed(() => this.currentUser().role === 'doctor');
  isAdmin     = computed(() => this.currentUser().role === 'admin');

  staffList = signal<StaffUser[]>([]);
  loading   = signal(false);
  error     = signal('');

  readonly PAGE_SIZE = 25;
  doctorsPage = 1;
  adminsPage  = 1;

  doctors = computed(() => this.staffList().filter(s => s.role === 'doctor'));
  admins  = computed(() => this.staffList().filter(s => s.role === 'admin'));

  pagedDoctors      = computed(() => this.doctors().slice((this.doctorsPage - 1) * this.PAGE_SIZE, this.doctorsPage * this.PAGE_SIZE));
  pagedAdmins       = computed(() => this.admins().slice((this.adminsPage - 1) * this.PAGE_SIZE, this.adminsPage * this.PAGE_SIZE));
  totalDoctorPages  = computed(() => Math.max(1, Math.ceil(this.doctors().length / this.PAGE_SIZE)));
  totalAdminPages   = computed(() => Math.max(1, Math.ceil(this.admins().length / this.PAGE_SIZE)));

  prevDoctorsPage(): void { if (this.doctorsPage > 1) this.doctorsPage--; }
  nextDoctorsPage(): void { if (this.doctorsPage < this.totalDoctorPages()) this.doctorsPage++; }
  prevAdminsPage(): void  { if (this.adminsPage > 1) this.adminsPage--; }
  nextAdminsPage(): void  { if (this.adminsPage < this.totalAdminPages()) this.adminsPage++; }

  sidebarOpen = false;

  showStaffModal    = false;
  staffModalMode: StaffFormMode = 'create';
  editingStaff: StaffUser | null = null;

  showResetModal = false;
  resetEmail     = '';

  // ── Horario de disponibilidad ──────────────────────────────────────────────
  scheduleDoctorId = '';
  doctorSchedules  = signal<DoctorSchedule[]>([]);
  scheduleLoading  = signal(false);

  showScheduleModal    = false;
  scheduleModalMode: ScheduleFormMode = 'create';
  editingScheduleBlock: DoctorSchedule | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadStaff();

    // El doctor siempre edita su propio horario; el admin elige a quién ver.
    if (this.isDoctor()) {
      this.scheduleDoctorId = this.currentUser().id_usuario;
    } else if (this.doctors().length > 0) {
      this.scheduleDoctorId = this.doctors()[0].id_usuario;
    }
    if (this.scheduleDoctorId) await this.loadSchedule();
  }

  private async loadStaff(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = await this.db.getStaffUsers();
      this.staffList.set(list);
    } catch {
      this.error.set('No se pudo cargar el equipo.');
    } finally {
      this.loading.set(false);
    }
  }

  openNewStaff(): void {
    this.editingStaff   = null;
    this.staffModalMode = 'create';
    this.showStaffModal = true;
  }

      selectedStaff: StaffUser | null = null;
    showDetailModal = false;

    verDetalle(staff: StaffUser): void {
      this.selectedStaff = staff;
      this.showDetailModal = true;
    }

  openEditStaff(staff: StaffUser): void {
    this.editingStaff   = staff;
    this.staffModalMode = 'edit';
    this.showStaffModal = true;
  }

  openResetPassword(email: string): void {
    this.showStaffModal = false;
    this.resetEmail     = email;
    this.showResetModal = true;
  }

  async onStaffSaved(data: StaffFormData): Promise<void> {
    this.showStaffModal = false;
    this.error.set('');
    try {
      if (this.staffModalMode === 'create') {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) throw new Error('Sesión expirada. Inicia sesión de nuevo.');

        const res = await fetch(
          `https://xfrsnvmqfecnkjvjfhra.supabase.co/functions/v1/invite-staff`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              email:     data.email,
              full_name: data.full_name,
              role:      data.role,
              specialty: data.specialty || null,
            }),
          }
        );
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? 'Error al invitar');
        }
        await this.loadStaff();
        this.toast.success(`Invitación enviada a ${data.email}`);
      } else {
        await this.db.updateStaffUser(data.id_usuario!, {
          full_name: data.full_name,
          role:      data.role,
          specialty: data.specialty || undefined,
        });
        await this.loadStaff();
        // Si el usuario editó su propio perfil, recargar el signal de auth
        // para que el menú lateral refleje el nuevo rol inmediatamente.
        if (data.id_usuario === this.auth.staffProfile()?.id_usuario) {
          await this.auth.loadStaffProfile(data.id_usuario!);
        }
        this.toast.success('Perfil del usuario actualizado');
      }
    } catch (err: any) {
      this.toast.error(err.message ?? 'Error al guardar los cambios.');
    }
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  getRoleLabel(role: UserRole): string {
    return role === 'doctor' ? 'Doctor' : 'Secretaria/o';
  }

  // ── Horario de disponibilidad ──────────────────────────────────────────────

  async onScheduleDoctorChange(event: Event): Promise<void> {
    this.scheduleDoctorId = (event.target as HTMLSelectElement).value;
    await this.loadSchedule();
  }

  private async loadSchedule(): Promise<void> {
    if (!this.scheduleDoctorId) { this.doctorSchedules.set([]); return; }
    this.scheduleLoading.set(true);
    try {
      this.doctorSchedules.set(await this.db.getHorariosDoctor(this.scheduleDoctorId));
    } finally {
      this.scheduleLoading.set(false);
    }
  }

  openNewScheduleBlock(): void {
    this.editingScheduleBlock = null;
    this.scheduleModalMode    = 'create';
    this.showScheduleModal    = true;
  }

  openEditScheduleBlock(block: DoctorSchedule): void {
    this.editingScheduleBlock = block;
    this.scheduleModalMode    = 'edit';
    this.showScheduleModal    = true;
  }

  async onScheduleSaved(block: DoctorSchedule): Promise<void> {
    this.showScheduleModal = false;
    try {
      await this.db.upsertHorarioBlock(block);
      await this.loadSchedule();
      this.toast.success('Horario guardado correctamente');
    } catch (err: any) {
      this.toast.error(err.message ?? 'Error al guardar el horario.');
    }
  }

  async onDeleteScheduleBlock(idHorario: string): Promise<void> {
    try {
      await this.db.deleteHorarioBlock(idHorario);
      await this.loadSchedule();
      this.toast.success('Bloque de horario eliminado');
    } catch (err: any) {
      this.toast.error(err.message ?? 'Error al eliminar el bloque.');
    }
  }

  async eliminarStaff(staff: StaffUser): Promise<void> {
  const confirmar = confirm(`¿Estás seguro de eliminar a ${staff.full_name}?`);
  if (!confirmar) return;
  try {
    const { error } = await this.supabase
      .from('staff_users')
      .delete()
      .eq('id_usuario', staff.id_usuario);
    if (error) throw error;
    this.showDetailModal = false;
    await this.loadStaff();
    this.toast.success(`${staff.full_name} eliminado correctamente`);
  } catch (err: any) {
    this.toast.error(err.message ?? 'Error al eliminar el usuario');
  }
}
}
