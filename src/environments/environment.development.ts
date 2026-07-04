export const environment = {
  production: false,
  supabase: {
    url: 'https://xfrsnvmqfecnkjvjfhra.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcnNudm1xZmVjbmtqdmpmaHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDU5NjYsImV4cCI6MjA5NzIyMTk2Nn0.PL6XNSPb76a-E7BVL7rPuXkeiJMiJvZhVZ-91tor1yE'
  },
  // TEMPORAL - DEV ONLY: número/código de prueba configurado en Supabase
  // Dashboard (Authentication > Providers > Phone > Test Phone Numbers),
  // usado por el botón de "saltar verificación" en login-paciente.
  otpBypass: true,
  otpBypassPhone: '9511255999',
  otpBypassCode: '123456'
};
