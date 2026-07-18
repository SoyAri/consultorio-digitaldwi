import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AgendarCita } from './agendar-cita';
import { DatabaseService } from '../../services/database.service';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';

const MOCK_PACIENTE = { id_paciente: 'p1', full_name: 'Juan Pérez', assigned_doctor_id: 'd1' };
const MOCK_DOCTOR    = { id_usuario: 'd1', full_name: 'Dra. Ana Torres', role: 'doctor', specialty: 'Ortodoncia', email: 'ana@x.com' };

describe('AgendarCita', () => {
  let component: AgendarCita;
  let fixture: ComponentFixture<AgendarCita>;
  let dbMock: {
    getPacienteById: ReturnType<typeof vi.fn>;
    getStaffById: ReturnType<typeof vi.fn>;
    getAvailableSlots: ReturnType<typeof vi.fn>;
  };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.setItem('patient_session', JSON.stringify({ id_paciente: 'p1', phone: '5512345678' }));

    dbMock = {
      getPacienteById: vi.fn().mockResolvedValue(MOCK_PACIENTE),
      getStaffById: vi.fn().mockResolvedValue(MOCK_DOCTOR),
      getAvailableSlots: vi.fn().mockResolvedValue(['09:00', '09:30']),
    };
    toastMock = { success: vi.fn(), error: vi.fn() };

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await TestBed.configureTestingModule({
      imports: [AgendarCita],
      providers: [
        provideRouter([]),
        { provide: DatabaseService, useValue: dbMock },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok123' } } }),
              },
            },
          },
        },
        { provide: ToastService, useValue: toastMock },
      ],
    }).compileComponents();

    // Se usa el Router real (provideRouter) en vez de un mock plano: el
    // Router expone estado interno (routerState, etc.) que RouterLink y el
    // resto de la maquinaria del router necesitan; un useValue con solo
    // {navigate: fn()} rompe esa maquinaria. Se espía navigate() en su lugar.
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(AgendarCita);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.removeItem('patient_session');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('en ngOnInit, resuelve y precarga SOLO el doctor asignado al paciente (no todo el directorio)', async () => {
    await component.ngOnInit();

    expect(dbMock.getPacienteById).toHaveBeenCalledWith('p1');
    expect(dbMock.getStaffById).toHaveBeenCalledWith('d1');
    expect(component.doctors()).toEqual([{ id_usuario: 'd1', full_name: 'Dra. Ana Torres', specialty: 'Ortodoncia' }]);
    expect(component.noAssignedDoctor()).toBe(false);
  });

  it('si el paciente no tiene doctor asignado, muestra el estado "sin doctor asignado"', async () => {
    dbMock.getPacienteById.mockResolvedValue({ id_paciente: 'p1', full_name: 'Juan Pérez', assigned_doctor_id: null });

    await component.ngOnInit();

    expect(component.noAssignedDoctor()).toBe(true);
    expect(component.doctors()).toEqual([]);
    expect(dbMock.getStaffById).not.toHaveBeenCalled();
  });

  it('pide slots disponibles solo cuando ya hay doctor y fecha elegidos', async () => {
    await component.onDoctorChange('d1');
    expect(dbMock.getAvailableSlots).not.toHaveBeenCalled();

    await component.onDateChange('2026-08-03');
    expect(dbMock.getAvailableSlots).toHaveBeenCalledWith('d1', '2026-08-03');
    expect(component.availableSlots()).toEqual(['09:00', '09:30']);
  });

  it('en éxito: muestra toast y navega de vuelta a /portal', async () => {
    await component.onDoctorChange('d1');
    await component.onDateChange('2026-08-03');

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id_cita: 'c1', scheduled_at: '2026-08-03T09:00:00-06:00',
        doctor_name: 'Dra. Ana Torres', patient_name: 'Juan Pérez', status: 'pendiente',
      }),
    });

    await component.onConfirm({ doctorId: 'd1', date: '2026-08-03', time: '09:00', reason: '' });

    expect(toastMock.success).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/portal']);
    expect(component.submitting()).toBe(false);
  });

  it('en 409: muestra error, refresca los slots y NO navega', async () => {
    await component.onDoctorChange('d1');
    await component.onDateChange('2026-08-03');

    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Ese horario ya no está disponible, elige otro' }),
    });

    await component.onConfirm({ doctorId: 'd1', date: '2026-08-03', time: '09:00', reason: '' });

    expect(toastMock.error).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    // 1 llamada al elegir fecha + 1 refresco tras el 409
    expect(dbMock.getAvailableSlots).toHaveBeenCalledTimes(2);
  });

  it('en 403 (doctor no asignado / teléfono no coincide): muestra el error del servidor y NO navega', async () => {
    await component.onDoctorChange('d1');
    await component.onDateChange('2026-08-03');

    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Solo puedes agendar citas con tu doctor asignado.' }),
    });

    await component.onConfirm({ doctorId: 'd1', date: '2026-08-03', time: '09:00', reason: '' });

    expect(toastMock.error).toHaveBeenCalledWith('Solo puedes agendar citas con tu doctor asignado.');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
