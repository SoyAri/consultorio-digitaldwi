-- ============================================================
-- CONSULTORIO DIGITAL — Horarios de disponibilidad + auto-agendamiento
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. HORARIOS_DISPONIBILIDAD ────────────────────────────────
-- Bloques semanales recurrentes de disponibilidad por doctor.
-- Un doctor puede tener varios bloques (ej. lunes 9-14 y lunes 16-19).
CREATE TABLE IF NOT EXISTS public.horarios_disponibilidad (
  id_horario             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_doctor              UUID NOT NULL REFERENCES public.staff_users(id_usuario) ON DELETE CASCADE,
  day_of_week            SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo … 6=sábado
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL CHECK (end_time > start_time),
  slot_duration_minutes  SMALLINT NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0),
  active                 BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.horarios_disponibilidad ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier staff o paciente autenticado (los pacientes necesitan
-- leerlo para calcular slots disponibles antes de agendar).
CREATE POLICY "horarios_select" ON public.horarios_disponibilidad
  FOR SELECT TO authenticated USING (true);

-- Escritura: SOLO staff. A diferencia del resto del schema (que usa
-- USING(true) para cualquier authenticated), aquí sí distinguimos porque
-- un paciente jamás debe poder escribir el horario de un doctor.
CREATE POLICY "horarios_write_staff_only" ON public.horarios_disponibilidad
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_users WHERE id_usuario = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff_users WHERE id_usuario = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_horarios_doctor_dia
  ON public.horarios_disponibilidad(id_doctor, day_of_week);

-- ── 2. TRIGGER updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_horarios_updated_at ON public.horarios_disponibilidad;
CREATE TRIGGER trg_horarios_updated_at
  BEFORE UPDATE ON public.horarios_disponibilidad
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. GUARDIA ANTI DOBLE-RESERVA ──────────────────────────────
-- Los slots del auto-agendamiento están cuantizados a una grilla fija
-- (start_time + n*slot_duration_minutes), así que dos reservas para
-- "el mismo horario" producen el MISMO scheduled_at exacto. Este índice
-- único parcial hace que Postgres rechace (error 23505) la segunda
-- inserción concurrente — es la defensa atómica real, no solo un
-- pre-chequeo del lado de la aplicación.
--
-- ⚠️ Antes de aplicar en un ambiente con datos existentes: verificar que
-- no haya ya citas duplicadas (mismo id_doctor + scheduled_at, status
-- pendiente/en_curso), o la creación del índice fallará. Verificar con:
--
--   SELECT id_doctor, scheduled_at, COUNT(*)
--   FROM public.citas
--   WHERE status IN ('pendiente', 'en_curso')
--   GROUP BY id_doctor, scheduled_at
--   HAVING COUNT(*) > 1;
--
CREATE UNIQUE INDEX IF NOT EXISTS uq_citas_doctor_slot
  ON public.citas(id_doctor, scheduled_at)
  WHERE status IN ('pendiente', 'en_curso');
