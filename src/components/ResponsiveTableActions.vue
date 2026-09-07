<template>
  <div class="responsive-table-actions">
    <div class="table-actions-desktop items-center gap-1">
      <v-btn
        v-for="action in accionesVisibles"
        :key="action.key"
        icon
        size="small"
        variant="tonal"
        :color="action.color"
        :loading="action.loading"
        :disabled="action.disabled"
        :aria-label="action.label"
        class="rounded-lg"
        @click="action.onClick"
      >
        <v-icon size="18">{{ action.icon }}</v-icon>
        <v-tooltip activator="parent" location="top">
          {{ action.label }}
        </v-tooltip>
      </v-btn>
    </div>

    <v-menu v-if="accionesVisibles.length" location="bottom end">
      <template #activator="{ props: activatorProps }">
        <v-btn
          v-bind="activatorProps"
          icon="mdi-dots-vertical"
          size="small"
          variant="tonal"
          aria-label="Mostrar acciones"
          class="table-actions-mobile rounded-lg"
        />
      </template>

      <v-list density="comfortable" min-width="220">
        <v-list-item
          v-for="action in accionesVisibles"
          :key="action.key"
          :prepend-icon="action.icon"
          :title="action.label"
          :disabled="action.disabled || action.loading"
          :class="action.danger ? 'text-error' : ''"
          @click="action.onClick"
        >
          <template v-if="action.loading" #append>
            <v-progress-circular indeterminate size="18" width="2" />
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  actions: {
    type: Array,
    default: () => []
  }
})

const accionesVisibles = computed(() => (
  props.actions.filter((action) => action.visible !== false)
))
</script>

<style scoped>
.table-actions-desktop {
  display: flex;
}

.responsive-table-actions {
  display: flex;
  justify-content: flex-end;
}

.table-actions-mobile {
  display: none;
}

@media (max-width: 600px) {
  .table-actions-desktop {
    display: none;
  }

  .table-actions-mobile {
    display: inline-flex;
  }
}
</style>
