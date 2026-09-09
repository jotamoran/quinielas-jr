import { supabase } from '@/lib/supabase';

export async function registrar({ email, password, nombreCompleto }) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_completo: nombreCompleto } },
  });
  if (error) throw error;
}

export async function verificarCodigo({ email, codigo }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw error;
}

export async function iniciarSesion({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export function resolverCorreo(entrada) {
  const limpio = entrada.trim();
  return limpio.toLowerCase() === 'admin' ? import.meta.env.VITE_ADMIN_ALIAS_EMAIL : limpio;
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
