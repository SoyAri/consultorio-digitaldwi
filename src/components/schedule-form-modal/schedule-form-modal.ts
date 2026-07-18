import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DoctorSchedule } from '../../app/models';

export type ScheduleFormMode = 'create' | 'edit';

const EMPTY_BLOCK: Omit<DoctorSchedule, 'id_doctor'> = {
  day_of_week: 1,
  start_time: '09:00',
  end_time: '14:00',
  slot_duration_minutes: 30,
  active: true,
};

@Component({
  selector: 'app-schedule-form-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-form-modal.html',
  styleUrl: './schedule-form-modal.css',
})
export class ScheduleFormModal implements OnChanges {
  @Input() mode: ScheduleFormMode = 'create';
  @Input() block: DoctorSchedule | null = null;
  @Input() doctorId = '';

  @Output() saved = new EventEmitter<DoctorSchedule>();
  @Output() closed = new EventEmitter<void>();

  readonly days = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
  ];

  readonly durations = [15, 20, 30, 45, 60];

  form: DoctorSchedule = { ...EMPTY_BLOCK, id_doctor: this.doctorId };
  error = '';

  get isCreate(): boolean { return this.mode === 'create'; }
  get title(): string { return this.isCreate ? 'Agregar bloque de horario' : 'Editar bloque de horario'; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['block'] || changes['mode'] || changes['doctorId']) {
      this.error = '';
      if (this.block && this.mode === 'edit') {
        this.form = { ...this.block };
      } else {
        this.form = { ...EMPTY_BLOCK, id_doctor: this.doctorId };
      }
    }
  }

  setDay(day: number): void {
    this.form.day_of_week = day;
  }

  submit(): void {
    this.error = '';

    if (!this.form.start_time || !this.form.end_time) {
      this.error = 'Hora de inicio y fin son requeridas.';
      return;
    }
    if (this.form.end_time <= this.form.start_time) {
      this.error = 'La hora de fin debe ser posterior a la hora de inicio.';
      return;
    }

    this.saved.emit({ ...this.form, id_doctor: this.doctorId });
    this.close();
  }

  close(): void {
    this.form = { ...EMPTY_BLOCK, id_doctor: this.doctorId };
    this.error = '';
    this.closed.emit();
  }
}
