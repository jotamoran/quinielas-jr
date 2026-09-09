import { defineStore } from 'pinia';

export const useLoginModalStore = defineStore('loginModal', {
  state: () => ({
    abierto: false,
  }),

  actions: {
    abrir() {
      this.abierto = true;
    },
    cerrar() {
      this.abierto = false;
    },
  },
});
