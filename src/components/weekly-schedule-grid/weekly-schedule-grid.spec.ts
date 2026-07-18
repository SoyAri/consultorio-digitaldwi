import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeeklyScheduleGrid } from './weekly-schedule-grid';
import { DoctorSchedule } from '../../app/models';

const MOCK_BLOCKS: DoctorSchedule[] = [
  { id_horario: '1', id_doctor: 'd1', day_of_week: 1, start_time: '09:00:00', end_time: '14:00:00', slot_duration_minutes: 30, active: true },
  { id_horario: '2', id_doctor: 'd1', day_of_week: 1, start_time: '16:00:00', end_time: '19:00:00', slot_duration_minutes: 30, active: false },
];

describe('WeeklyScheduleGrid', () => {
  let component: WeeklyScheduleGrid;
  let fixture: ComponentFixture<WeeklyScheduleGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyScheduleGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(WeeklyScheduleGrid);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('blocks', MOCK_BLOCKS);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('agrupa los bloques bajo la columna del día correspondiente', () => {
    const lunes = component.columns().find(c => c.value === 1);
    expect(lunes?.blocks.length).toBe(2);
    const martes = component.columns().find(c => c.value === 2);
    expect(martes?.blocks.length).toBe(0);
  });

  it('emite delete con el id_horario del bloque', () => {
    let deletedId = '';
    component.delete.subscribe(id => (deletedId = id));
    component.onDelete(MOCK_BLOCKS[0]);
    expect(deletedId).toBe('1');
  });
});
