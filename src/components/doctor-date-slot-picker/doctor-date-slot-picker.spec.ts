import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorDateSlotPicker } from './doctor-date-slot-picker';
import { DoctorOption } from '../../app/models';

const MOCK_DOCTORS: DoctorOption[] = [
  { id_usuario: 'd1', full_name: 'Dra. Ana Torres', specialty: 'Ortodoncia' },
];

describe('DoctorDateSlotPicker', () => {
  let component: DoctorDateSlotPicker;
  let fixture: ComponentFixture<DoctorDateSlotPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorDateSlotPicker],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorDateSlotPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('doctors', MOCK_DOCTORS);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no permite confirmar hasta tener doctor, fecha y slot', () => {
    expect(component.canConfirm()).toBe(false);
    component.selectedDoctorId.set('d1');
    component.selectedDate.set('2026-08-03');
    expect(component.canConfirm()).toBe(false);
    component.selectedSlot.set('09:00');
    expect(component.canConfirm()).toBe(true);
  });

  it('limpia el slot seleccionado si ya no aparece en la lista nueva de slots', () => {
    component.selectedSlot.set('09:00');
    fixture.componentRef.setInput('availableSlots', ['09:30', '10:00']);
    fixture.detectChanges();
    expect(component.selectedSlot()).toBe('');
  });

  it('emite confirm con el payload completo', () => {
    component.selectedDoctorId.set('d1');
    component.selectedDate.set('2026-08-03');
    component.selectedSlot.set('09:00');
    component.reason = 'Dolor de muela';

    let payload: any = null;
    component.confirm.subscribe(v => (payload = v));
    component.onConfirm();

    expect(payload).toEqual({ doctorId: 'd1', date: '2026-08-03', time: '09:00', reason: 'Dolor de muela' });
  });
});
