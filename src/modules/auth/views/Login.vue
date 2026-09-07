<template>
  <section class="w-full flex justify-center">
    <v-form ref="formLogin" @submit.prevent="ValidarFormulario" class="w-full max-w-md">
      <v-card class="rounded-2xl shadow-xl border w-full">
        
        <div class="bg-tracsa-principal text-white text-center py-6 rounded-t-2xl">
          <img src="@assets/logo.jpg" class="mx-auto mb-3 w-40" alt="Grupo TRACSA" />
          <h2 class="text-xl font-semibold">
            {{ $t("login.titulo") }}
          </h2>
        </div>

        <v-card-text class="pt-6">
          <v-text-field
            v-if="!cambiandoPassword"
            v-model="jDatosLogin.cCodigo"
            autocomplete="username"
            :label="$t('login.form.codigo')"
            variant="outlined"
            class="mb-4"
            :rules="[ValidaVacio, ValidaLongitudCodigo]"
          />

          <v-text-field
            v-if="!cambiandoPassword"
            v-model="jDatosLogin.cPassword"
            :label="$t('login.form.contrasenia')"
            :type="bVerPass ? 'text' : 'password'"
            autocomplete="current-password"
            variant="outlined"
            class="mb-6"
            :rules="[ValidaVacio]"
          >
            <template #append-inner>
              <v-btn
                :icon="bVerPass ? 'mdi-eye-off' : 'mdi-eye'"
                variant="text"
                density="compact"
                :aria-label="bVerPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="bVerPass = !bVerPass"
              />
            </template>
          </v-text-field>

          <template v-if="cambiandoPassword">
            <p class="mb-4 text-sm text-gray-600">
              Debes actualizar la contraseña antes de continuar.
            </p>
            <v-text-field
              v-model="nuevaPassword"
              label="Nueva contraseña"
              :type="verNuevaPassword ? 'text' : 'password'"
              autocomplete="new-password"
              variant="outlined"
              class="mb-4"
              :rules="[validarPasswordServicio]"
            >
              <template #append-inner>
                <v-btn
                  :icon="verNuevaPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  variant="text"
                  density="compact"
                  :aria-label="verNuevaPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'"
                  @click="verNuevaPassword = !verNuevaPassword"
                />
              </template>
            </v-text-field>
            <v-text-field
              v-model="confirmacionPassword"
              label="Confirmar contraseña"
              :type="verConfirmacionPassword ? 'text' : 'password'"
              autocomplete="new-password"
              variant="outlined"
              class="mb-6"
              :rules="[validarConfirmacion]"
            >
              <template #append-inner>
                <v-btn
                  :icon="verConfirmacionPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  variant="text"
                  density="compact"
                  :aria-label="verConfirmacionPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'"
                  @click="verConfirmacionPassword = !verConfirmacionPassword"
                />
              </template>
            </v-text-field>
          </template>

          <v-btn
            type="submit"
            :loading="autenticando || uiStore.isLoading"
            :disabled="autenticando"
            color="primary"
            size="large"
            block
          >
            {{ cambiandoPassword ? "Actualizar contraseña" : $t("login.form.boton") }}
          </v-btn>

        </v-card-text>

        <v-card-actions class="justify-center pb-4">
          <small class="text-center text-gray-500">
            <strong>{{ $t("login.texto_ayuda") }}</strong>
          </small>
        </v-card-actions>

      </v-card>
    </v-form>
  </section>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { cambiarPasswordServicio, loginRequest } from "../services/authService";
import { useAuthStore } from "@/store/auth";
import { useUiStore } from "@/store/ui";
import { ValidaVacio, notify } from "@/utils/funciones";
import { ValidaLongitudCodigo } from "../utils/funciones";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUiStore();

const formLogin = ref(null);
const bVerPass = ref(false);
const verNuevaPassword = ref(false);
const verConfirmacionPassword = ref(false);
const autenticando = ref(false);
const cambiandoPassword = ref(false);
const changeToken = ref("");
const nuevaPassword = ref("");
const confirmacionPassword = ref("");

const jDatosLogin = reactive({
  cCodigo: "",
  cPassword: "",
});

const ValidarFormulario = async () => {
  const { valid } = await formLogin.value.validate();
  if (!valid) {
    notify("Atención", t("login.errores.mensaje_form"), "warning");
    return;
  }
  if (cambiandoPassword.value) {
    await ejecutarCambioPassword();
    return;
  }

  await ejecutarLogin();
};

const validarPasswordServicio = (password) => {
  if (!password || password.length < 12) return "Usa al menos 12 caracteres";
  if (!/[A-Z]/.test(password)) return "Incluye al menos una mayúscula";
  if (!/[a-z]/.test(password)) return "Incluye al menos una minúscula";
  if (!/\d/.test(password)) return "Incluye al menos un número";
  return true;
};

const validarConfirmacion = (password) => {
  return password === nuevaPassword.value || "Las contraseñas no coinciden";
};

const ejecutarLogin = async () => {
  if (autenticando.value) return;

  autenticando.value = true;
  try {
    const response = await loginRequest(
      jDatosLogin.cCodigo,
      jDatosLogin.cPassword
    );

    const data = response.data;

    if (data.requiere_cambio_password) {
      changeToken.value = data.change_token;
      cambiandoPassword.value = true;
      jDatosLogin.cPassword = "";
      return;
    }

    authStore.login(
      data.usuario,
      data.token
    );

    notify("Bienvenido", data.usuario.nombre, "success");

    if (route.query.sistema) {
      window.location.href = import.meta.env.VITE_DNS + route.query.sistema;
    } else {
      router.push("/principal");
    }

  } catch (error) {
    const mensaje = error.response?.data?.message || "No fue posible iniciar sesión";

    notify("Error de login", mensaje, "error");

    console.error("Error en el flujo de login:", error);
  } finally {
    autenticando.value = false;
  }
};

const ejecutarCambioPassword = async () => {
  if (autenticando.value) return;

  autenticando.value = true;
  try {
    const response = await cambiarPasswordServicio(
      changeToken.value,
      nuevaPassword.value
    );
    notify("Contraseña actualizada", response.message, "success");
    cambiandoPassword.value = false;
    changeToken.value = "";
    nuevaPassword.value = "";
    confirmacionPassword.value = "";
  } catch (error) {
    const mensaje = error.response?.data?.message || "No fue posible actualizar la contraseña";
    notify("Error", mensaje, "error");
  } finally {
    autenticando.value = false;
  }
};
</script>
