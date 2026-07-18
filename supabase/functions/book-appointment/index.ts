import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Consultorio opera en la zona horaria de México (sin horario de verano
// desde 2022) — offset fijo, sin soporte multi-zona por ahora.
const CLINIC_UTC_OFFSET = '-06:00'

interface HorarioBlock {
  start_time: string             // "HH:mm:ss" (formato TIME de Postgres)
  end_time: string
  slot_duration_minutes: number
}

function timeToMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number)
  return h * 60 + m
}

// Verifica que `time` ("HH:mm") caiga exacto en la grilla de disponibilidad
// de alguno de los bloques activos del doctor para ese día de la semana.
function isSlotInSchedule(time: string, bloques: HorarioBlock[]): boolean {
  const requestedMin = timeToMinutes(time + ':00')
  for (const b of bloques) {
    const start = timeToMinutes(b.start_time)
    const end   = timeToMinutes(b.end_time)
    const step  = b.slot_duration_minutes
    if (requestedMin < start || requestedMin + step > end) continue
    if ((requestedMin - start) % step === 0) return true
  }
  return false
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // ── 1. Verificar que el que llama está autenticado ────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'No autorizado' })
    }
    const callerToken = authHeader.replace('Bearer ', '')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(callerToken)
    if (authError || !caller) {
      return json(401, { error: 'Token inválido o expirado' })
    }

    // ── 2. Validar body ────────────────────────────────────────────────────────
    const body = await req.json()
    const { id_doctor, date, time, reason } = body as {
      id_doctor?: string; date?: string; time?: string; reason?: string
    }

    if (!id_doctor || !date || !time) {
      return json(400, { error: 'Faltan campos' })
    }

    // ── 3. Resolver identidad del paciente del lado servidor por teléfono ─────
    // Nunca se confía en un id_paciente que venga del body — el JWT (verificado
    // por Supabase Auth vía OTP) es la única fuente de verdad de quién llama.
    // Mismo criterio de matching que usa login-paciente.ts / portal.ts.
    const callerPhone = (caller.phone ?? '').replace(/^\+52/, '')
    if (!callerPhone) {
      return json(403, { error: 'El teléfono de la sesión no coincide con el paciente' })
    }

    const { data: paciente, error: pacienteError } = await supabaseAdmin
      .from('pacientes')
      .select('id_paciente, full_name, phone')
      .eq('phone', callerPhone)
      .single()

    if (pacienteError || !paciente) {
      return json(403, { error: 'El teléfono de la sesión no coincide con el paciente' })
    }

    // ── 4. Resolver doctor (para nombre denormalizado) ─────────────────────────
    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('staff_users')
      .select('id_usuario, full_name, role')
      .eq('id_usuario', id_doctor)
      .eq('role', 'doctor')
      .single()

    if (doctorError || !doctor) {
      return json(400, { error: 'Doctor inválido' })
    }

    // ── 5. Validar que el horario solicitado exista en la disponibilidad ──────
    const dayOfWeek = new Date(`${date}T00:00:00${CLINIC_UTC_OFFSET}`).getUTCDay()

    const { data: bloques, error: bloquesError } = await supabaseAdmin
      .from('horarios_disponibilidad')
      .select('start_time, end_time, slot_duration_minutes')
      .eq('id_doctor', id_doctor)
      .eq('day_of_week', dayOfWeek)
      .eq('active', true)

    if (bloquesError || !bloques?.length || !isSlotInSchedule(time, bloques as HorarioBlock[])) {
      return json(400, { error: 'Horario inválido: no coincide con la disponibilidad del doctor' })
    }

    // ── 6. Pre-chequeo de traslape (UX) ────────────────────────────────────────
    // No es la defensa real contra doble-reserva concurrente (eso lo hace el
    // índice único de Postgres en el paso 7) — solo da un mensaje más claro
    // en el caso común (no-concurrente) de un slot ya ocupado.
    const scheduledAt = `${date}T${time}:00${CLINIC_UTC_OFFSET}`
    const scheduledMs = new Date(scheduledAt).getTime()
    const halfWindowMin = bloques[0].slot_duration_minutes / 2
    const from = new Date(scheduledMs - halfWindowMin * 60_000).toISOString()
    const to   = new Date(scheduledMs + halfWindowMin * 60_000).toISOString()

    const { data: conflictos } = await supabaseAdmin
      .from('citas')
      .select('id_cita')
      .eq('id_doctor', id_doctor)
      .in('status', ['pendiente', 'en_curso'])
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)

    if (conflictos && conflictos.length > 0) {
      return json(409, { error: 'Ese horario ya no está disponible, elige otro' })
    }

    // ── 7. Crear la cita ────────────────────────────────────────────────────────
    // El índice único parcial uq_citas_doctor_slot (id_doctor, scheduled_at)
    // WHERE status IN ('pendiente','en_curso') es la defensa atómica real:
    // si dos pacientes reservan el mismo slot a la vez, Postgres rechaza la
    // segunda inserción con error 23505, sin importar el pre-chequeo de arriba.
    const { data: cita, error: insertError } = await supabaseAdmin
      .from('citas')
      .insert({
        id_paciente:  paciente.id_paciente,
        id_doctor,
        patient_name: paciente.full_name,
        doctor_name:  doctor.full_name,
        scheduled_at: scheduledAt,
        reason:       reason || '',
        status:       'pendiente',
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return json(409, { error: 'Ese horario ya no está disponible, elige otro' })
      }
      console.error('book-appointment insert failed:', JSON.stringify(insertError))
      return json(500, { error: insertError.message ?? 'Error al agendar la cita' })
    }

    return json(200, {
      id_cita:      cita.id_cita,
      scheduled_at: cita.scheduled_at,
      doctor_name:  cita.doctor_name,
      patient_name: cita.patient_name,
      status:       cita.status,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
