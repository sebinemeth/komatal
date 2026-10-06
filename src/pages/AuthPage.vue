<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@nuxt/ui/composables'
import { isOrganiser, resetPassword, signInOrganiser, signUpOrganiser, vault } from '@/lib/session'
import UnlockPanel from '@/components/UnlockPanel.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const mode = ref<'in' | 'up'>('in')
const email = ref('')
const password = ref('')
const busy = ref(false)
const recoveryCode = ref('')
const saved = ref(false)
const hold = ref(false) // keep this page open while the recovery code is shown

const next = () => (typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/szervezo')

const messages: Record<string, string> = {
  'auth/invalid-credential': 'Hibás e-mail cím vagy jelszó.',
  'auth/email-already-in-use': 'Ezzel az e-mail címmel már van fiók.',
  'auth/weak-password': 'A jelszó legyen legalább 8 karakter.',
  'auth/invalid-email': 'Az e-mail cím nem érvényes.',
  'auth/too-many-requests': 'Túl sok próbálkozás, kérlek várj egy kicsit.',
  'auth/operation-not-allowed': 'A belépés még nincs bekapcsolva a Firebase-ben.',
}

async function submit() {
  busy.value = true
  try {
    if (mode.value === 'up') {
      hold.value = true
      recoveryCode.value = await signUpOrganiser(email.value, password.value)
    }
    else await signInOrganiser(email.value, password.value)
  } catch (e) {
    hold.value = false
    const code = (e as { code?: string }).code ?? ''
    toast.add({ title: messages[code] ?? 'Nem sikerült belépni.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}

async function forgot() {
  if (!email.value) return toast.add({ title: 'Írd be az e-mail címed', color: 'warning' })
  await resetPassword(email.value).catch(() => undefined)
  toast.add({ title: 'Ha van ilyen fiók, elküldtük a jelszó-visszaállító levelet.', icon: 'i-lucide-mail-check' })
}

async function copyCode() {
  await navigator.clipboard.writeText(recoveryCode.value)
  toast.add({ title: 'Kimásolva', icon: 'i-lucide-check' })
}

function download() {
  const blob = new Blob([`Komatál helyreállító kód\n\n${recoveryCode.value}\n\nE-mail: ${email.value}\n`], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'komatal-helyreallito-kod.txt'
  a.click()
}

watch(
  () => [isOrganiser.value, vault.status, hold.value] as const,
  ([org, status, held]) => {
    if (org && status === 'ready' && !held) router.replace(next())
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-5">
    <div v-if="recoveryCode" class="space-y-4">
      <UCard>
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <span class="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><UIcon name="i-lucide-life-buoy" class="size-6" /></span>
            <div>
              <h2 class="font-bold text-highlighted">Mentsd el a helyreállító kódot</h2>
              <p class="text-sm text-muted">Ha elfelejted a jelszavad, ezzel érheted el újra a komatáljaidat. Csak most látod.</p>
            </div>
          </div>
          <p class="rounded-xl bg-muted p-4 text-center font-mono text-xl font-bold tracking-wider text-highlighted select-all">{{ recoveryCode }}</p>
          <div class="flex gap-2">
            <UButton icon="i-lucide-copy" color="neutral" variant="soft" label="Másolás" block @click="copyCode" />
            <UButton icon="i-lucide-download" color="neutral" variant="soft" label="Letöltés" block @click="download" />
          </div>
          <UCheckbox v-model="saved" label="Elmentettem a kódot biztonságos helyre" />
          <UButton block :disabled="!saved" label="Tovább" @click="router.replace(next())" />
        </div>
      </UCard>
    </div>

    <template v-else>
      <UnlockPanel v-if="vault.status === 'locked'" />
      <UCard v-else>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-1 text-center">
            <h1 class="text-2xl font-extrabold text-highlighted">{{ mode === 'in' ? 'Belépés szervezőknek' : 'Új szervezői fiók' }}</h1>
            <p class="text-sm text-muted">A segítőknek nem kell fiók, nekik elég a meghívó link.</p>
          </div>
          <UFormField label="E-mail cím"><UInput v-model="email" type="email" autocomplete="email" class="w-full" required /></UFormField>
          <UFormField label="Jelszó" :hint="mode === 'up' ? 'legalább 8 karakter' : undefined">
            <UInput v-model="password" type="password" :autocomplete="mode === 'up' ? 'new-password' : 'current-password'" minlength="8" class="w-full" required />
          </UFormField>
          <UButton type="submit" block :loading="busy" :label="mode === 'in' ? 'Belépés' : 'Fiók létrehozása'" />
          <div class="flex justify-between text-sm">
            <button type="button" class="text-primary underline" @click="mode = mode === 'in' ? 'up' : 'in'">
              {{ mode === 'in' ? 'Még nincs fiókom' : 'Már van fiókom' }}
            </button>
            <button v-if="mode === 'in'" type="button" class="text-muted underline" @click="forgot">Elfelejtett jelszó</button>
          </div>
        </form>
      </UCard>
    </template>
  </div>
</template>
