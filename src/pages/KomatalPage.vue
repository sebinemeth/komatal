<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ensureHelperAuth } from '@/lib/session'
import KomatalView from '@/components/KomatalView.vue'

defineProps<{ id: string }>()
const ready = ref(false)
const failed = ref(false)

onMounted(async () => {
  try {
    await ensureHelperAuth()
    ready.value = true
  } catch (e) {
    console.error(e)
    failed.value = true
  }
})
</script>

<template>
  <KomatalView v-if="ready" :id="id" :key="id" />
  <UAlert
    v-else-if="failed"
    color="error"
    variant="subtle"
    icon="i-lucide-circle-alert"
    title="Nem sikerült csatlakozni"
    description="Ellenőrizd a kapcsolatot, és töltsd újra az oldalt."
  />
  <div v-else class="space-y-3">
    <USkeleton class="h-10 w-2/3" />
    <USkeleton class="h-40 w-full rounded-2xl" />
  </div>
</template>
