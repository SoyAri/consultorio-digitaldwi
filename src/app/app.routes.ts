import { Routes } from '@angular/router';
import { staffGuard, patientGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  // ── Públicas ───────────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./inicio/inicio').then(m => m.Inicio),
  },
  {
    path: 'login/paciente',
    loadComponent: () => import('./login/login-paciente/login-paciente').then(m => m.LoginPaciente),
  },
  {
    path: 'login/equipo',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login-equipo/login-equipo').then(m => m.LoginEquipo),
  },

  // ── Portal del Paciente ────────────────────────────────────────────────────
  {
    path: 'portal',
    canActivate: [patientGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./portal/portal').then(m => m.Portal),
      },
      {
        path: 'consultas/:idConsulta',
        loadComponent: () => import('./portal/consulta-detalle/consulta-detalle').then(m => m.ConsultaDetalle),
      },
      {
        path: 'agendar',
        loadComponent: () => import('./portal/agendar-cita/agendar-cita').then(m => m.AgendarCita),
      },
    ],
  },

  // ── Módulo del Consultorio (Staff) ─────────────────────────────────────────
  {
    path: 'consultorio',
    canActivate: [staffGuard],
    loadComponent: () => import('./consultorio/consultorio').then(m => m.Consultorio),
  },
  {
    path: 'agenda',
    canActivate: [staffGuard],
    loadComponent: () => import('./agendar/agendar').then(m => m.Agendar),
  },
  {
    path: 'agendar',
    redirectTo: 'agenda',
  },
  {
    path: 'pacientes',
    canActivate: [staffGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pacientes/directorio/directorio').then(m => m.Directorio),
      },
      {
        path: ':id',
        children: [
          {
            path: '',
            loadComponent: () => import('./pacientes/perfil/perfil').then(m => m.Perfil),
          },
          {
            path: 'historial',
            loadComponent: () => import('./pacientes/historial/historial').then(m => m.Historial),
          },
          {
            path: 'consultas/:idConsulta',
            loadComponent: () => import('./pacientes/expediente/expediente').then(m => m.Expediente),
          },
          {
            path: 'cita/:id',
            loadComponent: () => import('./portal/consulta-detalle/consulta-detalle').then(m => m.ConsultaDetalle),
          },
        ],
      },
    ],
  },
  {
    path: 'configuracion',
    canActivate: [staffGuard],
    loadComponent: () => import('./configuracion/configuracion').then(m => m.Configuracion),
  },

  // ── Callback de invitación por email ──────────────────────────────────────
  {
    path: 'auth/callback',
    loadComponent: () => import('./auth-callback/auth-callback').then(m => m.AuthCallback),
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
