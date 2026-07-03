import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const staffGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService).client;
  const router   = inject(Router);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return router.createUrlTree(['/login/equipo']);
  }
  return true;
};

// Evita que un usuario ya autenticado entre al login de staff.
// Si hay sesión activa, lo manda directo al dashboard.
export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService).client;
  const router   = inject(Router);

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    return router.createUrlTree(['/consultorio']);
  }
  return true;
};

// [TODO-SEGURIDAD] RESPONSABILIDAD: COMPAÑERO PORTAL
// DEPENDE DE: OTP implementado en login-paciente.ts.
// Al estar listo, sessionStorage 'patient_session' = { id_paciente, phone }.
//
// MEJORAR patientGuard — actualmente solo verifica que exista
// patient_session en sessionStorage, que puede ser manipulado desde DevTools.
//
// REEMPLAZAR con verificación asíncrona en dos capas:
//
//   export const patientGuard: CanActivateFn = async () => {
//     const supabase = inject(SupabaseService).client;
//     const router   = inject(Router);
//
//     // Capa 1: verificar sesión real de Supabase Auth
//     const { data: { session } } = await supabase.auth.getSession();
//     if (!session) {
//       sessionStorage.removeItem('patient_session');
//       return router.createUrlTree(['/login/paciente']);
//     }
//
//     // Capa 2: verificar que el phone del JWT coincide con el sessionStorage
//     const stored = sessionStorage.getItem('patient_session');
//     if (!stored) return router.createUrlTree(['/login/paciente']);
//     const { phone } = JSON.parse(stored);
//     if (session.user.phone !== '+52' + phone) {
//       sessionStorage.removeItem('patient_session');
//       await supabase.auth.signOut();
//       return router.createUrlTree(['/login/paciente']);
//     }
//
//     return true;
//   };
//
// Nota: CanActivateFn ya soporta Promise<boolean | UrlTree> — no requiere
// cambios en app.routes.ts. SupabaseService ya está importado arriba.
export const patientGuard: CanActivateFn = () => {
  const router = inject(Router);
  const session = sessionStorage.getItem('patient_session');
  if (!session) {
    return router.createUrlTree(['/login/paciente']);
  }
  return true;
};
