import { onMounted, onUnmounted } from 'vue';

// Repite `refrescar` cada `cadaMs` (por defecto 2 minutos, igual que el Worker de marcadores).
// No consulta con la pestaña oculta y, al volver a verla, actualiza si pasó el intervalo.
// Los errores se ignoran: la pantalla conserva lo que ya mostraba.
export function usarRefrescoPeriodico(refrescar, cadaMs = 120000) {
  let temporizador;
  let ultimo = Date.now();

  async function ejecutar() {
    ultimo = Date.now();
    try { await refrescar(); } catch { /* se conserva lo mostrado */ }
  }

  function alCambiarVisibilidad() {
    if (!document.hidden && Date.now() - ultimo >= cadaMs) ejecutar();
  }

  onMounted(() => {
    ultimo = Date.now();
    temporizador = setInterval(() => { if (!document.hidden) ejecutar(); }, cadaMs);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
  });
  onUnmounted(() => {
    clearInterval(temporizador);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  });
}
