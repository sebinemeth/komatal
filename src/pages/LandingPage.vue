<script setup lang="ts">
import { isOrganiser } from '@/lib/session'

const features = [
  { icon: 'i-lucide-link', title: 'Egyetlen link', text: 'A barátok egy linkkel csatlakoznak, regisztráció nélkül. Nincs csoport, nincs táblázat.' },
  { icon: 'i-lucide-hourglass', title: 'Várólista, majd egy gombnyomás', text: 'Szülés előtt mindenki feliratkozik. Amikor megszületik a baba, egy gombbal értesül mindenki, és foglalhat napot.' },
  { icon: 'i-lucide-shield-check', title: 'Titkosítva', text: 'A cím, az allergiák és az elérhetőségek az eszközödön titkosítva tárolódnak, a szerver nem látja őket.' },
]
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-4 pt-4 text-center">
      <span class="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/15 text-primary"><UIcon name="i-lucide-soup" class="size-9" /></span>
      <h1 class="text-3xl font-extrabold tracking-tight text-highlighted sm:text-4xl">Szervezz komatált percek alatt</h1>
      <p class="text-lg text-muted">Tizenkét nap meleg étel az újszülött családjának. Mi elintézzük a beosztást, te csak főzöl.</p>
      <div class="flex flex-col items-center gap-2 pt-2">
        <UButton :to="isOrganiser ? '/uj' : { path: '/belepes', query: { next: '/uj' } }" size="xl" icon="i-lucide-plus" label="Komatál indítása" />
        <p class="text-sm text-muted">Meghívót kaptál? Nyisd meg a kapott linket.</p>
      </div>
    </section>

    <section class="grid gap-3">
      <UCard v-for="f in features" :key="f.title" :ui="{ body: 'flex gap-4 items-start' }">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><UIcon :name="f.icon" class="size-6" /></span>
        <div>
          <h2 class="font-bold text-highlighted">{{ f.title }}</h2>
          <p class="text-sm text-muted">{{ f.text }}</p>
        </div>
      </UCard>
    </section>
  </div>
</template>
