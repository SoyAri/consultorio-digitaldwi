import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DoctorSchedule } from '../../app/models';

interface DayColumn {
  value: number;
  label: string;
  blocks: DoctorSchedule[];
}

@Component({
  selector: 'app-weekly-schedule-grid',
  imports: [CommonModule],
  templateUrl: './weekly-schedule-grid.html',
  styleUrl: './weekly-schedule-grid.css',
})
export class WeeklyScheduleGrid {
  private blocksSignal = signal<DoctorSchedule[]>([]);

  @Input() set blocks(value: DoctorSchedule[]) {
    this.blocksSignal.set(value ?? []);
  }

  @Output() edit = new EventEmitter<DoctorSchedule>();
  @Output() delete = new EventEmitter<string>();

  private readonly dayLabels = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
  ];

  columns = computed<DayColumn[]>(() => {
    const all = this.blocksSignal();
    return this.dayLabels.map(day => ({
      ...day,
      blocks: all
        .filter(b => b.day_of_week === day.value)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
  });

  formatRange(block: DoctorSchedule): string {
    return `${block.start_time.slice(0, 5)} – ${block.end_time.slice(0, 5)}`;
  }

  onEdit(block: DoctorSchedule): void {
    this.edit.emit(block);
  }

  onDelete(block: DoctorSchedule): void {
    if (block.id_horario) this.delete.emit(block.id_horario);
  }
}
