import Swal from 'sweetalert2';
import { corporateColors } from '@/theme/corporate';


export const ValidaVacio = (v) =>{
    return !!v || 'El campo no puede ir vacio'
}

export const getMonthName = (monthNumber) => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[parseInt(monthNumber) - 1] || 'Mes inválido';
};

export const getStatusText = (status) => {
  const statusMap = {
    0: 'Pendiente',
    1: 'Autorizada',
    2: 'Rechazada',
    3: 'Aplicada',
    98: 'Cancelada'
  };
  return statusMap[status] || 'Desconocido';
};

export const formatoMoneda = (
  valor,
  { moneda = 'MXN', decimales = 3 } = {}
) => {
  const numero = parseFloat(valor) || 0;
  return new Intl.NumberFormat('es-MX', { 
    style: 'currency', 
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(numero);
};
export const validarEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const formatoFecha = (fecha) => {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-MX');
};

export const formatoFechaMedia = (fecha, textoVacio = 'Sin fecha') => {
  if (!fecha) return textoVacio;

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium'
  }).format(new Date(fecha));
};
export const validarRFC = (rfc) => {
  const regex = /^([A-ZÑ&]{3,4}) ?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])) ?(?:- ?)?([A-Z\d]{2})([A\d])$/;
  return regex.test(rfc.toUpperCase().trim());
};

export const notify = (titulo, texto, icono = 'success', timer) => {
  // Los errores y advertencias permanecen hasta que el usuario los cierre.
  const requiereLectura = icono === 'error' || icono === 'warning';

  const duracion = timer === undefined
    ? (requiereLectura ? null : 2500)
    : timer;

  return Swal.fire({
    title: titulo,
    text: texto,
    icon: icono,
    timer: duracion ?? undefined,
    showConfirmButton: !duracion,
    confirmButtonText: 'Entendido',
    confirmButtonColor: corporateColors.primary,
    timerProgressBar: !!duracion,
    customClass: {
      container: 'swal-sobre-modal'
    },
    didOpen: () => {
      const boton = Swal.getConfirmButton();
      if (boton) boton.style.color = corporateColors.secondary;
    }
  });
};
 
export const confirmDialog = async (titulo, texto, confirmText = 'Sí, continuar') => {
  const result = await Swal.fire({
    title: titulo,
    text: texto,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: corporateColors.primary,
    cancelButtonColor: corporateColors.error,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      const boton = Swal.getConfirmButton();
      if (boton) boton.style.color = corporateColors.secondary;
    }
  });
  
  return result.isConfirmed;
};

export const copyToClipboard = async (text, mensajes = {}) => {
  try {
    await navigator.clipboard.writeText(text);
    notify(
      mensajes.tituloExito || 'Copiado',
      mensajes.textoExito || 'Texto copiado al portapapeles',
      'success',
      mensajes.timer ?? 1000
    );
  } catch (err) {
    notify(
      mensajes.tituloError || 'Error',
      mensajes.textoError || 'No se pudo copiar',
      'error'
    );
  }
};

export const validarCorreoRegla = (valor) => {
  if (!valor) return true;

  return validarEmail(valor) || 'Ingresa un correo electrónico válido';
};

export const obtenerMensajeErrorApi = (
  error,
  mensajeDefault = 'Ocurrió un error inesperado'
) => {
  let mensaje =
    error.response?.data?.message ||
    error.response?.data?.detail?.[0]?.msg ||
    error.response?.data?.detail ||
    mensajeDefault;

  if (typeof mensaje !== 'string') {
    mensaje = mensajeDefault;
  }

  if (
    mensaje.includes('valid email address') ||
    mensaje.includes('valid top-level domain')
  ) {
    return 'Ingresa un correo electrónico válido.';
  }

  if (mensaje.includes('Field required')) {
    return 'Faltan campos obligatorios.';
  }

  return mensaje;
};

export const notifyErrorSobreModal = (
  titulo,
  texto,
  timer = null
) => {
  return Swal.fire({
    title: titulo,
    text: texto,
    icon: 'error',
    timer,
    showConfirmButton: timer ? false : true,
    timerProgressBar: !!timer,
    confirmButtonText: 'Aceptar',
    confirmButtonColor: corporateColors.primary,
    customClass: {
      container: 'swal-sobre-modal'
    },
    didOpen: () => {
      const boton = Swal.getConfirmButton();
      if (boton) boton.style.color = corporateColors.secondary;
    }
  });
};

export const validarPasswordConfirmacion = (
  password,
  confirmacion
) => {
  return (
    password === confirmacion ||
    "Las contraseñas no coinciden"
  );
};
