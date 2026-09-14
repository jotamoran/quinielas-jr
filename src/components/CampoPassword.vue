<script setup>
import { ref } from 'vue';

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Contraseña' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'current-password' },
  minlength: { type: Number, default: undefined },
});

defineEmits(['update:modelValue']);

const visible = ref(false);
</script>

<template>
  <label class="form-label">
    {{ label }}
    <span class="relative mt-1 block">
      <input
        :value="modelValue"
        :type="visible ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :minlength="minlength"
        required
        class="form-control !mt-0 pr-20"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-1 my-auto rounded-lg px-2.5 text-xs font-semibold text-quiniela-verde hover:bg-green-50"
        :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        {{ visible ? 'Ocultar' : 'Mostrar' }}
      </button>
    </span>
  </label>
</template>
