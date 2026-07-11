import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StaffUser, UserRole, StaffFormMode, StaffFormData } from '../models';
import { StaffFormModal } from '../../components/staff-form-modal/staff-form-modal';
import { ResetPasswordModal } from '../../components/reset-password-modal/reset-password-modal';
import { Sidebar } from '../../components/sidebar/sidebar';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import { SupabaseService } from '../services/supabase.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-configuracion',
  imports: [CommonModule, RouterModule, Sidebar, StaffFormModal, ResetPasswordModal],
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

  async ngOnInit(): Promise<void> {
    await this.loadStaff();
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
