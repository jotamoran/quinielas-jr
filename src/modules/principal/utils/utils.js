export const formatearIcono = (icono) => {
  return icono || 'mdi-help-circle';
};

export const tieneDescripcion = (desc) => {
  return desc?.trim() || 'Sin descripción';
};