import { supabase } from '@/lib/supabase';

export async function registrar({ email, password, nombreCompleto, username }) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_completo: nombreCompleto, username } },
  });
  if (error) throw error;
}

export async function verificarCodigo({ email, codigo }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw error;
}

export async function usernameDisponible(username) {
  const respuesta = await fetch(`/api/auth/username-disponible?${new URLSearchParams({ username })}`);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  return datos.disponible;
}

export async function iniciarSesion({ entrada, password }) {
  const respuesta = await fetch('/api/auth/iniciar-sesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entrada, password }),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  const { error } = await supabase.auth.setSession({ access_token: datos.access_token, refresh_token: datos.refresh_token });
  if (error) throw error;
}

const MENSAJES_ERROR_AUTH = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
};

export function traducirErrorAuth(mensaje) {
  return MENSAJES_ERROR_AUTH[mensaje] ?? mensaje;
}

export async function recuperarPassword({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function actualizarNombre(nombreCompleto) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión de nuevo.');
  const { error } = await supabase.from('perfiles').update({ nombre_completo: nombreCompleto }).eq('id', user.id);
  if (error) throw error;
}

export async function actualizarCorreo(nuevoCorreo) {
  const { error } = await supabase.auth.updateUser({ email: nuevoCorreo });
  if (error) throw error;
}

export async function actualizarPassword(nuevaPassword) {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}
