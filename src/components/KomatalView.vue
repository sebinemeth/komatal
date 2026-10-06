<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { KomatalCtxKey } from '@/composables/ctx'
import { useKomatal } from '@/composables/useKomatal'
import { passwordFor, vault } from '@/lib/session'
import { isPersisted, rememberedPassword, storePassword } from '@/lib/helperKeys'
import HelperKomatal from './HelperKomatal.vue'
import OrganiserKomatal from './OrganiserKomatal.vue'
import UnlockPanel from './UnlockPanel.vue'

const props = defineProps<{ id: string }>()
const route = useRoute()
const ctx = useKomatal(props.id)
provide(KomatalCtxKey, ctx)

const typed = ref('')
const wrong = ref(false)
const busy = ref(false)
const askRemember = ref(false)
let settled = false

const needsVault = computed(() => ctx.isOrganiserOf.value && (vault.status === 'locked' || vault.status === 'loading'))

/** Tries the password from the link, then the organiser vault, then what this device remembered. */
async function autoUnlock() {
  if (settled || !ctx.komatal.value || ctx.key.value) return
  if (ctx.isOrganiserOf.value && (vault.status === 'loading' || vault.status === 'locked')) return
  settled = true
  const fromLink = route.hash.slice(1)
  const candidates = [fromLink, ctx.isOrganiserOf.value ? passwordFor(props.id) : null, rememberedPassword(props.id)].filter((p): p is string => !!p)
  for (const c of candidates) {
    if (await ctx.unlock(c)) {
      if (!ctx.isOrganiserOf.value) {
        const persisted = isPersisted(props.id)
        storePassword(props.id, c, persisted)
        askRemember.value = c === fromLink && !persisted
      }
      return
    }
  }
}

watch([ctx.komatal, () => vault.status, () => ctx.isOrganiserOf.value], autoUnlock, { immediate: true })

async function submitPassword() {
  busy.value = true
  wrong.value = false
  const ok = await ctx.unlock(typed.value)
  busy.value = false
  if (!ok) return void (wrong.value = true)
  if (!ctx.isOrganiserOf.value) {
    storePassword(props.id, typed.value, false)
    askRemember.value = true
  }
}

function remember(yes: boolean) {
  storePassword(props.id, ctx.password.value, yes)
  askRemember.value = false
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="ctx.komatal.value === undefined" class="space-y-3">
      <USkeleton class="h-10 w-2/3" />
      <USkeleton class="h-40 w-full rounded-2xl" />
    </div>

    <UCard v-else-if="ctx.komatal.value === null" class="text-center">
      <div class="space-y-2 py-4">
        <UIcon name="i-lucide-search-x" class="mx-auto size-10 text-muted" />
        <p class="font-bold text-highlighted">Ez a komatál nem található</p>
        <p class="text-sm text-muted">Ellenőrizd a linket, vagy kérj újat a szervezőtől.</p>
      </div>
    </UCard>

    <UnlockPanel v-else-if="needsVault" />

    <UCard v-else-if="!ctx.key.value">
      <form class="space-y-4" @submit.prevent="submitPassword">
        <div class="flex items-center gap-3">
          <span class="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><UIcon name="i-lucide-key-round" class="size-6" /></span>
          <div>
            <h2 class="font-bold text-highlighted">{{ ctx.komatal.value.name }} komatálja</h2>
            <p class="text-sm text-muted">Írd be a meghívóban kapott jelszót.</p>
          </div>
        </div>
        <UFormField label="Jelszó" :error="wrong ? 'Ez a jelszó nem jó' : undefined">
          <UInput v-model="typed" placeholder="xxxx-xxxx-xxxx" class="w-full font-mono" autocomplete="off" required />
        </UFormField>
        <UButton type="submit" block :loading="busy" label="Megnyitás" />
      </form>
    </UCard>

    <template v-else>
      <UAlert
        v-if="askRemember"
        color="neutral"
        variant="subtle"
        icon="i-lucide-smartphone"
        title="Megjegyezhet ez az eszköz?"
        description="Akkor legközelebb nem kell újra megnyitnod a meghívó linket."
        :actions="[
          { label: 'Megjegyzem', color: 'primary', onClick: () => remember(true) },
          { label: 'Most nem', color: 'neutral', variant: 'ghost', onClick: () => remember(false) },
        ]"
      />
      <OrganiserKomatal v-if="ctx.isOrganiserOf.value" />
      <HelperKomatal v-else />
    </template>
  </div>
</template>
