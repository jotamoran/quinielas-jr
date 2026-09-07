import mainApi from '@/api/mainApi';

export const obtenerMenuSistema = async (clave) => {
  const { data } = await mainApi.get(`/api/auth/menu/${clave}`, {
    showGlobalLoading: false
  });
  return data;
};
