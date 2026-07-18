import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduleFormModal } from './schedule-form-modal';

describe('ScheduleFormModal', () => {
  let component: ScheduleFormModal;
  let fixture: ComponentFixture<ScheduleFormModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleFormModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleFormModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('doctorId', 'doctor-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rechaza cuando la hora de fin no es posterior a la de inicio', () => {
    component.form.start_time = '10:00';
    component.form.end_time   = '09:00';
    let emitted = false;
    component.saved.subscribe(() => (emitted = true));

    component.submit();

    expect(emitted).toBe(false);
    expect(component.error).toContain('posterior');
  });

  it('emite el bloque completo con id_doctor al guardar', () => {
    component.form.start_time = '09:00';
    component.form.end_time   = '14:00';
    let result: any = null;
    component.saved.subscribe(v => (result = v));

    component.submit();

    expect(result).toEqual(
      expect.objectContaining({ id_doctor: 'doctor-1', start_time: '09:00', end_time: '14:00' })
    );
  });
});
