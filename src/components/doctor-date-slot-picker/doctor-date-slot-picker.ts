import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DoctorOption } from '../../app/models';

export interface BookingConfirmPayload {
  doctorId: string;
  date: string;
  time: string;
  reason: string;
}

@Component({
  selector: 'app-doctor-date-slot-picker',
  imports: [CommonModule, FormsModule],
  templateUrl: './doctor-date-slot-picker.html',
  styleUrl: './doctor-date-slot-picker.css',
})
export class DoctorDateSlotPicker implements OnChanges {
  @Input() doctors: DoctorOption[] = [];
  @Input() availableSlots: string[] = [];
  @Input() loadingSlots = false;
  @Input() submitting = false;
  @Input() errorMessage = '';

  @Output() doctorChange = new EventEmitter<string>();
  @Output() dateChange   = new EventEmitter<string>();
  @Output() confirm      = new EventEmitter<BookingConfirmPayload>();

  selectedDoctorId = signal('');
  selectedDate     = signal('');
  selectedSlot     = signal('');
  reason = '';

  readonly minDate = new Date().toISOString().split('T')[0];

  // Método normal (no computed()): `submitting` es un @Input() plano, no una
  // señal, así que un computed() no lo tomaría como dependencia reactiva y
  // quedaría con un valor cacheado y desactualizado mientras se envía la cita.
  canConfirm(): boolean {
    return !this.submitting && !!this.selectedDoctorId() && !!this.selectedDate() && !!this.selectedSlot();
  }

  // Si el listado de slots cambia (nueva fecha/doctor, o refresco tras un
  // 409 del servidor), el slot previamente elegido ya no es válido salvo
  // que siga presente en la lista nueva.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['availableSlots'] && !this.availableSlots.includes(this.selectedSlot())) {
      this.selectedSlot.set('');
    }
  }

  onDoctorSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedDoctorId.set(id);
    this.selectedSlot.set('');
    this.doctorChange.emit(id);
  }

  onDateSelect(event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    this.selectedDate.set(date);
    this.selectedSlot.set('');
    this.dateChange.emit(date);
  }

  selectSlot(slot: string): void {
    this.selectedSlot.set(slot);
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    this.confirm.emit({
      doctorId: this.selectedDoctorId(),
      date:     this.selectedDate(),
      time:     this.selectedSlot(),
      reason:   this.reason.trim(),
    });
  }
}
