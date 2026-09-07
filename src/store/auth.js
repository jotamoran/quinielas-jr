import { defineStore } from 'pinia';
import { jwtDecode } from "jwt-decode";

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null,
    user: null,
    sistemas: [],
    menu: [],
    sistemaActual: null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    getUserMenu: (state) => state.menu,
    getSistemas: (state) => state.sistemas,
  },

  actions: {
    login(usuario, token) {
      this.token = token;

      const decoded = jwtDecode(token);

      this.user = {
        id: usuario.id,
        nombre: usuario.nombre,
        codigo: decoded.codigo,
        roleId: decoded.role_id
      };

      this.menu = [];
      this.sistemaActual = null;
    },

    setSistemas(sistemas) {
      this.sistemas = sistemas || [];
    },

    setMenu(menu) {
      this.menu = menu || [];
    },

    setSistemaActual(sistema) {
      this.sistemaActual = sistema || null;
    },

    logout() {
      this.token = null;
      this.user = null;
      this.sistemas = [];
      this.menu = [];
      this.sistemaActual = null;
    }
  },

  persist: {
    key: 'auth',
    storage: localStorage,
    paths: ['token', 'user', 'sistemas', 'menu', 'sistemaActual']
  }
});
