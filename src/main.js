import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'

import router from './router/index'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as componentes from 'vuetify/components'
import * as directivas from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import { es } from 'vuetify/locale'

import { createI18n } from 'vue-i18n'
import mensajesEs from './i18n/es.json'
import { corporateColors } from './theme/corporate'

import './style.css'

const vuetify = createVuetify({
  locale: {
    locale: 'es',
    fallback: 'es',
    messages: { es }
  },

  components: componentes,
  directives: directivas,

  theme: {
    defaultTheme: 'tracsaTheme',
    themes: {
      tracsaTheme: {
        dark: false,
        colors: {
          primary: corporateColors.primary,
          secondary: corporateColors.secondary,
          error: corporateColors.error,
          success: corporateColors.success,
          warning: corporateColors.warning,
          info: corporateColors.info,
          background: corporateColors.background,
          surface: corporateColors.surface
        }
      }
    }
  },

  defaults: {
    global: {
      style: {
        fontFamily: 'Regular, sans-serif'
      }
    }
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'es',
  messages: {
    es: mensajesEs
  }
})

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router)
app.use(vuetify)
app.use(i18n)

app.mount('#app')
