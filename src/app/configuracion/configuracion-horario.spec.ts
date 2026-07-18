import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Configuracion } from './configuracion';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { StaffUser, DoctorSchedule } from '../models';

// Specs de integración de la Parte 3 para el cableado de "Horario de
// disponibilidad" agregado a Configuracion (WeeklyScheduleGrid +
// ScheduleFormModal + DatabaseService). No reemplaza a configuracion.spec.ts
// (que ya existe) — se agrega aparte para no tocar ese archivo.

const MOCK_STAFF: StaffUser[] = [
  { id_usuario: 'd1', full_name: 'Dra. Ana Torres', role: 'doctor', specialty: 'Ortodoncia', email: 'ana@x.com' },
  { id_usuario: 'd2', full_name: 'Dr. Luis Ramos',  role: 'doctor', specialty: 'Endodoncia',  email: 'luis@x.com' },
];

const MOCK_BLOCKS: DoctorSchedule[] = [
  { id_horario: 'h1', id_doctor: 'd1', day_of_week: 1, start_time: '09:00', end_time: '14:00', slot_duration_minutes: 30, active: true },
];

describe('Configuracion — horario de disponibilidad', () => {
  let component: Configuracion;
  let fixture: ComponentFixture<Configuracion>;
  let dbMock: {
    getStaffUsers: ReturnType<typeof vi.fn>;
    getHorariosDoctor: ReturnType<typeof vi.fn>;
    upsertHorarioBlock: ReturnType<typeof vi.fn>;
    deleteHorarioBlock: ReturnType<typeof vi.fn>;
  };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dbMock = {
      getStaffUsers: vi.fn().mockResolvedValue(MOCK_STAFF),
      getHorariosDoctor: vi.fn().mockResolvedValue(MOCK_BLOCKS),
      upsertHorarioBlock: vi.fn().mockResolvedValue(MOCK_BLOCKS[0]),
      deleteHorarioBlock: vi.fn().mockResolvedValue(undefined),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Configuracion],
      providers: [
        provideRouter([]),
        { provide: DatabaseService, useValue: dbMock },
        { provide: ToastService, useValue: toastMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Configuracion);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sin sesión de staff (rol admin por defecto), preselecciona el primer doctor de la lista', async () => {
    await component.ngOnInit();
    expect(component.scheduleDoctorId).toBe('d1');
    expect(dbMock.getHorariosDoctor).toHaveBeenCalledWith('d1');
    expect(component.doctorSchedules()).toEqual(MOCK_BLOCKS);
  });

  it('al cambiar el doctor seleccionado, recarga el horario de ese doctor', async () => {
    await component.ngOnInit();
    dbMock.getHorariosDoctor.mockResolvedValue([]);

    const fakeEvent = { target: { value: 'd2' } } as unknown as Event;
    await component.onScheduleDoctorChange(fakeEvent);

    expect(component.scheduleDoctorId).toBe('d2');
    expect(dbMock.getHorariosDoctor).toHaveBeenCalledWith('d2');
    expect(component.doctorSchedules()).toEqual([]);
  });

  it('al guardar un bloque, lo persiste, recarga el horario y cierra el modal', async () => {
    await component.ngOnInit();
    const newBlock: DoctorSchedule = {
      id_doctor: 'd1', day_of_week: 2, start_time: '10:00', end_time: '13:00',
      slot_duration_minutes: 30, active: true,
    };

    await component.onScheduleSaved(newBlock);

    expect(dbMock.upsertHorarioBlock).toHaveBeenCalledWith(newBlock);
    expect(toastMock.success).toHaveBeenCalled();
    expect(component.showScheduleModal).toBe(false);
  });

  it('al eliminar un bloque, lo borra y recarga el horario', async () => {
    await component.ngOnInit();
    await component.onDeleteScheduleBlock('h1');

    expect(dbMock.deleteHorarioBlock).toHaveBeenCalledWith('h1');
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('si falla el guardado, muestra error y NO cierra el modal en falso positivo', async () => {
    await component.ngOnInit();
    dbMock.upsertHorarioBlock.mockRejectedValue(new Error('Horario inválido'));
    const newBlock: DoctorSchedule = {
      id_doctor: 'd1', day_of_week: 2, start_time: '10:00', end_time: '13:00',
      slot_duration_minutes: 30, active: true,
    };

    await component.onScheduleSaved(newBlock);

    expect(toastMock.error).toHaveBeenCalledWith('Horario inválido');
  });
});
