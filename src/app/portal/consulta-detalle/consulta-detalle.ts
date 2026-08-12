import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ThemeToggle } from '../../../components/theme-toggle/theme-toggle';
import { AccessibilityWidget } from '../../../components/accessibility-widget/accessibility-widget';
import { AccessibilityService } from '../../services/accessibility.service';

interface ConsultaDetalleData {
  id_historial: string;
  visit_date: string;
  chief_complaint: string;
  diagnosis: string;
  treatment: string;
  observations: string;
  prescriptions: { medicine: string; dosage: string; frequency: string; duration: string }[];
  next_visit_date: string | null;
  doctor_name: string;
}

@Component({
  selector: 'app-consulta-detalle',
  imports: [CommonModule, ThemeToggle, AccessibilityWidget],
  templateUrl: './consulta-detalle.html',
  styleUrl: './consulta-detalle.css',
})
export class ConsultaDetalle implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private supabase = inject(SupabaseService).client;
  protected a11y   = inject(AccessibilityService);

  consulta = signal<ConsultaDetalleData | null>(null);
  loading  = signal(true);

  async ngOnInit(): Promise<void> {
    const sessionStr = sessionStorage.getItem('patient_session');
    if (!sessionStr) { this.router.navigate(['/login/paciente']); return; }
    const { id_paciente } = JSON.parse(sessionStr) as { id_paciente: string; phone: string };

    const idConsulta = this.route.snapshot.paramMap.get('idConsulta');
    if (!idConsulta) { this.router.navigate(['/portal']); return; }

    const { data, error } = await this.supabase
      .from('consultas')
      .select('id_historial, visit_date, chief_complaint, diagnosis, treatment, observations, prescriptions, next_visit_date, doctor_name')
      .eq('id_historial', idConsulta)
      .eq('id_paciente', id_paciente)
      .single();

    if (error || !data) {
      this.router.navigate(['/portal']);
      return;
    }
    this.consulta.set(data);
    this.loading.set(false);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  goBack(): void {
    this.router.navigate(['/portal']);
  }
}