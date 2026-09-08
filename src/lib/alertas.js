import Swal from 'sweetalert2';

const base = { confirmButtonColor: '#0f5132', cancelButtonColor: '#6b7280', customClass: { container: 'swal-sobre-modal', popup: 'rounded-2xl' } };

export function alertaExito(title, text = '') {
  return Swal.fire({ ...base, icon: 'success', title, text });
}

export function alertaError(error, title = 'No se pudo completar') {
  return Swal.fire({ ...base, icon: 'error', title, text: error?.message ?? String(error) });
}

export async function confirmarAccion({ title, text, confirmText = 'Confirmar', danger = false }) {
  const result = await Swal.fire({ ...base, icon: 'question', title, text, showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar', confirmButtonColor: danger ? '#e3212e' : base.confirmButtonColor });
  return result.isConfirmed;
}
