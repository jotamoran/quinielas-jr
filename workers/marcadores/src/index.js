import { sincronizarMarcadores } from './marcadores.js';

export default {
  async scheduled(_evento, env) {
    await sincronizarMarcadores(env);
  },
};
