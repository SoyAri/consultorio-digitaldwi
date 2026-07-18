// ── Tipos compartidos a nivel de aplicación ──────────────────────────────────
// Importados por cualquier feature: consultorio, pacientes, portal, etc.

export type UserRole = 'doctor' | 'admin';
export type AppointmentStatus = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
export type ClinicStatus = 'en_tratamiento' | 'dado_de_alta' | 'inactivo';
export type PatientFormMode = 'create' | 'edit';
export type AppointmentFormMode = 'create' | 'edit';

export interface DoctorOption {
  id_usuario: string;
  full_name: string;
  specialty: string;
}

// ── Ficha completa del paciente ───────────────────────────────────────────────
// Coincide con la tabla `patients` de Supabase + historial médico extendido.
export interface PatientDetail {
  id_paciente?: string;

  // Básicos (únicos verdaderamente obligatorios en el formulario)
  full_name: string;
  birth_date: string;

  // Contacto
  phone: string;
  email: string;
  address: string;
  gender: string;

  // Datos físicos
  blood_type: string;
  weight_kg: string;
  height_cm: string;

  // Alergias
  has_allergies: boolean;
  allergies_medications: string;
  allergies_materials: string;
  allergies_other: string;

  // Antecedentes sistémicos
  has_chronic_conditions: boolean;
  chronic_conditions: string;
  takes_medications: boolean;
  current_medications: string;
  has_previous_surgeries: boolean;
  surgeries_detail: string;
  is_pregnant: 'si' | 'no' | 'na';
  smokes: boolean;
  drinks_alcohol: boolean;

  // Antecedentes dentales
  had_dental_treatment: boolean;
  last_dental_visit: string;
  dental_treatments_history: string;
  has_dental_sensitivity: boolean;
  sensitivity_triggers: string;
  has_braces_history: boolean;
  has_prosthetics: boolean;
  prosthetics_detail: string;

  // Motivo y notas
  chief_complaint: string;
  notes: string;

  // Asignación
  assigned_doctor_id: string;
  clinic_status: ClinicStatus;
}

// ── Datos de cita ─────────────────────────────────────────────────────────────
// Coincide con la tabla `appointments` de Supabase.
export interface AppointmentFormData {
  id_cita?: string;
  id_paciente: string;
  patient_name: string;
  id_doctor: string;
  scheduled_date: string;
  scheduled_time: string;
  reason: string;
  notes: string;
  status: AppointmentStatus;
}

// ── Valores vacíos por defecto ────────────────────────────────────────────────
export const EMPTY_PATIENT: PatientDetail = {
  full_name: '', birth_date: '',
  phone: '', email: '', address: '', gender: '',
  blood_type: '', weight_kg: '', height_cm: '',
  has_allergies: false, allergies_medications: '', allergies_materials: '', allergies_other: '',
  has_chronic_conditions: false, chronic_conditions: '',
  takes_medications: false, current_medications: '',
  has_previous_surgeries: false, surgeries_detail: '',
  is_pregnant: 'na', smokes: false, drinks_alcohol: false,
  had_dental_treatment: false, last_dental_visit: '', dental_treatments_history: '',
  has_dental_sensitivity: false, sensitivity_triggers: '',
  has_braces_history: false, has_prosthetics: false, prosthetics_detail: '',
  chief_complaint: '', notes: '', assigned_doctor_id: '',
  clinic_status: 'en_tratamiento',
};

export const EMPTY_APPOINTMENT: AppointmentFormData = {
  id_paciente: '', patient_name: '', id_doctor: '',
  scheduled_date: '', scheduled_time: '',
  reason: '', notes: '', status: 'pendiente',
};

// ── Usuario del staff (admin/doctor) ─────────────────────────────────────────
export interface StaffUser {
  id_usuario: string;
  full_name: string;
  role: UserRole;
  specialty?: string;
  email: string;
}

// ── Gestión de miembros del staff ─────────────────────────────────────────────
export type StaffFormMode = 'create' | 'edit';

export interface StaffFormData {
  id_usuario?: string;
  full_name: string;
  email: string;
  role: UserRole;
  specialty: string;
}

export const EMPTY_STAFF: StaffFormData = {
  full_name: '',
  email: '',
  role: 'doctor',
  specialty: '',
};

// ── Registro clínico de consulta ──────────────────────────────────────────────
export type ConsultationFormMode = 'create' | 'edit';

export interface PrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface ConsultationRecord {
  id_historial?: string;
  id_paciente: string;
  patient_name: string;
  id_doctor: string;
  doctor_name: string;
  id_cita?: string;
  visit_date: string;
  chief_complaint: string;
  diagnosis: string;
  treatment: string;
  observations: string;
  prescriptions: PrescriptionItem[];
  next_visit_date: string;
}

export const EMPTY_PRESCRIPTION: PrescriptionItem = {
  medicine: '', dosage: '', frequency: '', duration: '',
};

export const EMPTY_CONSULTATION: ConsultationRecord = {
  id_paciente: '', patient_name: '',
  id_doctor: '', doctor_name: '',
  id_cita: '', visit_date: '',
  chief_complaint: '', diagnosis: '',
  treatment: '', observations: '',
  prescriptions: [], next_visit_date: '',
};

// ── Horarios de disponibilidad del doctor ─────────────────────────────────────
// Coincide con la tabla `horarios_disponibilidad` de Supabase.
export interface DoctorSchedule {
  id_horario?: string;
  id_doctor: string;
  day_of_week: number;           // 0=domingo … 6=sábado (igual que Date.getDay())
  start_time: string;            // "HH:mm"
  end_time: string;               // "HH:mm"
  slot_duration_minutes: number; // 15 | 20 | 30 | 45 | 60
  active: boolean;
}

// ── Auto-agendamiento del paciente (Edge Function book-appointment) ──────────
export interface BookAppointmentRequest {
  id_paciente: string;  // solo referencia UX — el servidor re-verifica por teléfono del JWT
  id_doctor: string;
  date: string;          // "YYYY-MM-DD"
  time: string;          // "HH:mm"
  reason?: string;
}

export interface BookAppointmentResponse {
  id_cita: string;
  scheduled_at: string;
  doctor_name: string;
  patient_name: string;
  status: 'pendiente';
}
