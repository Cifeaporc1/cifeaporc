// Datos de conexión con Supabase. La clave "publishable" está pensada para ir
// dentro de la app: la protección real son las reglas de acceso de la base de datos.
// NUNCA pongas aquí la clave "secret" ni la contraseña de la base de datos.
window.CONFIG = {
  supabaseUrl: 'https://mnfkzidvwgnqyvaidczt.supabase.co',
  supabaseKey: 'sb_publishable_oX5DsKI3WIhqkY-j6EDgKg_jJ84vVwh',
  // Dominio ficticio para las cuentas de alumno (alias + granja). No se envía ningún correo.
  dominioAlumnos: 'alumnos.cifeaporc.app',
  version: '0.3.1',
};
