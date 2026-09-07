import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null,
    user: null,
    perfil: null,
    listo: false,
  }),

  getters: {
    isLoggedIn: (state) => !!state.session,
    isAdmin: (state) => state.perfil?.rol === 'admin',
  },

  actions: {
    async cargarPerfil() {
      if (!this.user) {
        this.perfil = null;
        return;
      }
      const { data } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, rol')
        .eq('id', this.user.id)
        .single();
      this.perfil = data ?? null;
    },

    async init() {
      const { data: { session } } = await supabase.auth.getSession();
      this.session = session;
      this.user = session?.user ?? null;
      await this.cargarPerfil();
      this.listo = true;

      supabase.auth.onAuthStateChange(async (_event, session) => {
        this.session = session;
        this.user = session?.user ?? null;
        await this.cargarPerfil();
      });
    },

    async cerrarSesion() {
      await supabase.auth.signOut();
      this.session = null;
      this.user = null;
      this.perfil = null;
    },
  },
});
