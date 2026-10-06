<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { watchMyKomatals } from '@/lib/api'
import { session, vault } from '@/lib/session'
import { formatDay } from '@/lib/schedule'
import type { Komatal, Status } from '@/lib/types'
import UnlockPanel from '@/components/UnlockPanel.vue'

const list = ref<Komatal[] | null>(null)
let off: (() => void) | undefined
watch(
  () => session.user?.uid,
  (uid) => {
    off?.()
    if (uid) off = watchMyKomatals(uid, (k) => (list.value = k))
  },
  { immediate: true },
)
onScopeDispose(() => off?.())

const badge: Record<Status, { label: string; color: 'warning' | 'success' | 'neutral'; icon: string }> = {
  waiting: { label: 'Várakozik', color: 'warning', icon: 'i-lucide-hourglass' },
  active: { label: 'Folyamatban', color: 'success', icon: 'i-lucide-soup' },
  closed: { label: 'Lezárva', color: 'neutral', icon: 'i-lucide-archive' },
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-extrabold text-highlighted">Komatáljaim</h1>
      <UButton to="/uj" icon="i-lucide-plus" label="Új komatál" />
    </div>

    <UnlockPanel />

    <div v-if="list === null" class="space-y-3">
      <USkeleton class="h-24 w-full rounded-2xl" />
      <USkeleton class="h-24 w-full rounded-2xl" />
    </div>
    <UCard v-else-if="!list.length" class="text-center">
      <div class="space-y-3 py-4">
        <span class="mx-auto grid size-14 place-items-center rounded-3xl bg-primary/10 text-primary"><UIcon name="i-lucide-soup" class="size-8" /></span>
        <p class="font-semibold text-highlighted">Még nincs komatálod</p>
        <p class="text-sm text-muted">Indíts egyet, és küldd el a linket a barátoknak.</p>
        <UButton to="/uj" label="Komatál indítása" icon="i-lucide-plus" />
      </div>
    </UCard>
    <div v-else class="space-y-3">
      <RouterLink v-for="k in list" :key="k.id" :to="`/k/${k.id}`" class="block">
        <UCard :ui="{ body: 'flex items-center justify-between gap-3' }" class="transition hover:shadow-md">
          <div class="min-w-0">
            <p class="truncate font-bold text-highlighted">{{ k.name }}</p>
            <p class="text-sm text-muted">
              <UIcon name="i-lucide-baby" class="mr-1 inline size-4 align-[-3px]" />{{ k.birthDate ? formatDay(k.birthDate, { month: 'long', day: 'numeric' }) : `várható: ${formatDay(k.dueDate, { month: 'long', day: 'numeric' })}` }}
              · {{ k.dayCount }} nap
            </p>
          </div>
          <UBadge :color="badge[k.status].color" variant="subtle" :icon="badge[k.status].icon" :label="badge[k.status].label" />
        </UCard>
      </RouterLink>
    </div>
    <p v-if="vault.status === 'missing'" class="text-sm text-muted">A fiókodhoz még nem tartozik titkosított tároló, hozz létre egy új fiókot.</p>
  </div>
</template>
