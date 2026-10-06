<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { useCtx } from '@/composables/ctx'
import { cancelSlot } from '@/lib/api'
import { formatDay } from '@/lib/schedule'

const ctx = useCtx()
const toast = useToast()

async function release(index: number) {
  const k = ctx.komatal.value
  if (!k) return
  await cancelSlot(k, index).catch(() => toast.add({ title: 'Nem sikerült felszabadítani', color: 'error' }))
}
</script>

<template>
  <div class="divide-y divide-default">
    <div v-for="s in ctx.slots.value" :key="s.index" class="flex items-start gap-3 py-3">
      <div class="w-16 shrink-0 text-center">
        <p class="font-extrabold text-highlighted">{{ s.index + 1 }}. nap</p>
        <p v-if="s.date" class="text-xs text-muted">{{ formatDay(s.date, { month: 'short', day: 'numeric' }) }}</p>
      </div>
      <div class="min-w-0 flex-1 text-sm">
        <template v-if="s.status === 'reserved'">
          <p class="font-semibold text-highlighted">{{ ctx.slotData.value[s.index]?.label || 'Segítő' }}</p>
          <p class="text-toned">{{ ctx.slotData.value[s.index]?.meal }}</p>
          <p v-if="ctx.slotData.value[s.index]?.note" class="text-muted"><UIcon name="i-lucide-clock" class="mr-1 inline size-3.5" />{{ ctx.slotData.value[s.index]?.note }}</p>
          <p v-if="s.reservedBy && ctx.contacts.value[s.reservedBy]" class="mt-1 flex flex-wrap gap-x-3 text-muted">
            <span>{{ ctx.contacts.value[s.reservedBy]!.name }}</span>
            <a v-if="ctx.contacts.value[s.reservedBy]!.phone" :href="`tel:${ctx.contacts.value[s.reservedBy]!.phone}`" class="text-primary underline">{{ ctx.contacts.value[s.reservedBy]!.phone }}</a>
            <a v-if="ctx.contacts.value[s.reservedBy]!.email" :href="`mailto:${ctx.contacts.value[s.reservedBy]!.email}`" class="text-primary underline">{{ ctx.contacts.value[s.reservedBy]!.email }}</a>
          </p>
        </template>
        <p v-else class="text-muted">Szabad nap</p>
      </div>
      <UBadge v-if="s.status === 'free'" color="neutral" variant="subtle" label="szabad" />
      <UButton v-else-if="ctx.komatal.value?.status !== 'closed'" size="xs" color="neutral" variant="ghost" icon="i-lucide-undo-2" aria-label="Felszabadítás" @click="release(s.index)" />
    </div>
  </div>
</template>
