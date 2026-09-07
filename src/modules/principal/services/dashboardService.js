import mainApi from '@/api/mainApi';

export const obtenerSistemas = async (showGlobalLoading = true) => {
  const { data } = await mainApi.get('/api/auth/sistemas', { showGlobalLoading });
  return data.data;
};
