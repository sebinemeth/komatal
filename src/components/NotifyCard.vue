<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { useCtx } from '@/composables/ctx'
import { enablePush, pushAvailable, pushPermission } from '@/lib/push'
import { session } from '@/lib/session'

const ctx = useCtx()
const toast = useToast()
const available = ref(true)
const permission = ref(pushPermission())
const busy = ref(false)
const emailOn = (() => {
  try {
    return localStorage.getItem(`komatal:email:${ctx.komatal.value?.id}`) === '1'
  } catch {
    return false
  }
})()

onMounted(async () => (available.value = await pushAvailable()))

async function turnOn() {
  const k = ctx.komatal.value
  if (!k || !session.user) return
  busy.value = true
  const r = await enablePush(k, session.user.uid)
  busy.value = false
  permission.value = pushPermission()
  if (r === 'granted') toast.add({ title: 'Értesítések bekapcsolva', icon: 'i-lucide-bell-ring' })
  else if (r === 'denied') toast.add({ title: 'Az értesítések le vannak tiltva a böngészőben', color: 'warning', icon: 'i-lucide-bell-off' })
  else toast.add({ title: 'Ezen az eszközön most nem sikerült bekapcsolni', color: 'warning' })
}
</script>

<template>
  <UCard>
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><UIcon :name="permission === 'granted' ? 'i-lucide-bell-ring' : 'i-lucide-bell'" class="size-6" /></span>
        <div>
          <h2 class="font-bold text-highlighted">Értesítések</h2>
          <p class="text-sm text-muted">Szólunk, ha megszületik a baba, ha új hír érkezik, és a foglalt napod előtt egy nappal 18:00-kor.</p>
        </div>
      </div>
      <UBadge v-if="emailOn" color="success" variant="subtle" icon="i-lucide-mail-check" label="E-mail értesítés bekapcsolva" />
      <template v-if="permission === 'granted'">
        <UBadge color="success" variant="subtle" icon="i-lucide-check" label="Értesítés ezen az eszközön bekapcsolva" />
      </template>
      <UButton v-else-if="available && permission !== 'denied'" block icon="i-lucide-bell-ring" :loading="busy" label="Értesítések engedélyezése" @click="turnOn" />
      <p v-else-if="permission === 'denied'" class="text-sm text-muted">Az értesítések le vannak tiltva. A böngésző beállításaiban engedélyezheted.</p>
      <p v-else class="text-sm text-muted">Ez a böngésző nem támogatja az értesítést. iPhone-on add hozzá az oldalt a kezdőképernyőhöz, és onnan nyisd meg.</p>
    </div>
  </UCard>
</template>
