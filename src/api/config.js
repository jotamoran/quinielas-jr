import Swal from 'sweetalert2';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { corporateColors } from '@/theme/corporate';

let mostrandoSesionExpirada = false;

export function setupInterceptors(axiosInstance, defaultAuth = true) {
  axiosInstance.interceptors.request.use(
    (config) => {
      const uiStore = useUiStore();
      const authStore = useAuthStore();

      config.__usesGlobalLoading = config.showGlobalLoading !== false;
      if (config.__usesGlobalLoading) uiStore.startLoading();

      if (config.customToken) {
        config.headers['X-Custom-Auth'] = config.customToken;
      } else if (
        (config.useAppToken || defaultAuth) &&
        authStore.token &&
        !config.headers.Authorization
      ) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
      }

      return config;
    },
    (error) => {
      if (error.config?.__usesGlobalLoading) uiStore.stopLoading();
      return Promise.reject(error);
    }
  );

  axiosInstance.interceptors.response.use(
    (response) => {
      const uiStore = useUiStore();
      if (response.config?.__usesGlobalLoading) uiStore.stopLoading();
      return response;
    },
    (error) => {
      const uiStore = useUiStore();
      const authStore = useAuthStore();

      if (error.config?.__usesGlobalLoading) uiStore.stopLoading();

      const status = error.response?.status;
      const originalRequest = error.config;

      if (status === 401) {
        if (
          originalRequest?.url?.includes('/auth/login') ||
          originalRequest?.url?.includes('/auth/cambiar-password-servicio')
        ) {
          return Promise.reject(error);
        }

        authStore.logout();

        if (!mostrandoSesionExpirada) {
          mostrandoSesionExpirada = true;
          Swal.fire({
            icon: 'warning',
            title: 'Sesión finalizada',
            text: error.response?.data?.message || 'Tu sesión ha expirado. Inicia sesión nuevamente.',
            confirmButtonColor: corporateColors.primary,
            didOpen: () => {
              const confirmButton = Swal.getConfirmButton();
              if (confirmButton) {
                confirmButton.style.color = corporateColors.secondary;
              }
            }
          }).then(() => {
            mostrandoSesionExpirada = false;
            window.location.hash = '#/';
          }).catch(() => {
            mostrandoSesionExpirada = false;
          });
        }

        return Promise.reject(error);
      }

      if (status === 403) {
        if (originalRequest?.url?.includes('/auth/login')) {
          return Promise.reject(error);
        }

        return Promise.reject(error);
      }

      else if (status >= 500) {
        return Promise.reject(error);
      }

      else if (!error.response) {
        if (originalRequest?.url?.includes('/auth/login')) {
          return Promise.reject(error);
        }

        Swal.fire({
          icon: 'error',
          title: 'Error del servidor',
          text: 'Ocurrió un error inesperado, intenta más tarde',
          confirmButtonColor: corporateColors.primary,
          didOpen: () => {
            const confirmButton = Swal.getConfirmButton();
            if (confirmButton) confirmButton.style.color = corporateColors.secondary;
          }
        });
      }

      else if ([400, 409, 422].includes(status)) {
        return Promise.reject(error);
      }

      else {
        console.error('API Error:', error);
      }

      return Promise.reject(error);
    }
  );
}
