const CODIGO_REGLA_DE_NEGOCIO = 'P0001';

// Los errores de base de datos traen detalles técnicos: solo se muestran los mensajes propios (RAISE de nuestras funciones).
export function mensajeVisible(error) {
  const mensaje = String(error?.message ?? error ?? '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(mensaje)) {
    return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
  }
  const esErrorDeBaseDeDatos = error && typeof error === 'object' && 'details' in error && 'hint' in error;
  if (esErrorDeBaseDeDatos && error.code !== CODIGO_REGLA_DE_NEGOCIO) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  return error?.message ?? mensaje;
}
