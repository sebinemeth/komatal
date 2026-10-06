<script setup lang="ts">
import { useRouter } from 'vue-router'
import { isOrganiser, logout } from '@/lib/session'

const router = useRouter()
async function out() {
  await logout()
  router.push('/')
}
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <div class="min-h-dvh flex flex-col">
      <header class="sticky top-0 z-20 border-b border-default bg-default/85 backdrop-blur">
        <div class="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <RouterLink to="/" class="flex items-center gap-2 text-lg font-extrabold text-highlighted">
            <span class="grid size-8 place-items-center rounded-xl bg-primary text-inverted"><UIcon name="i-lucide-soup" class="size-5" /></span>
            Komatál
          </RouterLink>
          <nav class="flex items-center gap-1">
            <template v-if="isOrganiser">
              <UButton to="/szervezo" icon="i-lucide-layout-list" variant="ghost" color="neutral" label="Komatáljaim" />
              <UButton icon="i-lucide-log-out" variant="ghost" color="neutral" aria-label="Kilépés" @click="out" />
            </template>
            <UButton v-else to="/belepes" icon="i-lucide-user-round" variant="ghost" color="neutral" label="Szervezőknek" />
          </nav>
        </div>
      </header>
      <main class="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <RouterView />
      </main>
      <footer class="px-4 pb-8 pt-2 text-center text-xs text-muted">
        <UIcon name="i-lucide-lock" class="mr-1 inline size-3.5 align-[-2px]" />A személyes adatok titkosítva, az eszközödön olvashatók.
      </footer>
    </div>
  </UApp>
</template>
