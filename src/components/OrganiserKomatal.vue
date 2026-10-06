<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from '@nuxt/ui/composables'
import { useCtx } from '@/composables/ctx'
import { closeKomatal, extendDays, markBorn, MAX_DAYS, removeHelper } from '@/lib/api'
import { formatDay, todayHu } from '@/lib/schedule'
import PostComposer from './PostComposer.vue'
import PostFeed from './PostFeed.vue'
import SlotList from './SlotList.vue'

const ctx = useCtx()
const route = useRoute()
const toast = useToast()
const k = computed(() => ctx.komatal.value!)

const tab = ref(route.query.uj ? 'invite' : 'calendar')
const tabs = [
  { label: 'Naptár', icon: 'i-lucide-calendar-days', value: 'calendar', slot: 'calendar' as const },
  { label: 'Hírek', icon: 'i-lucide-newspaper', value: 'feed', slot: 'feed' as const },
  { label: 'Meghívó', icon: 'i-lucide-link', value: 'invite', slot: 'invite' as const },
  { label: 'Beállítások', icon: 'i-lucide-settings', value: 'settings', slot: 'settings' as const },
]

const link = computed(() => `${location.origin}/k/${k.value.id}#${ctx.password.value}`)
async function copy(text: string, title = 'Kimásolva') {
  await navigator.clipboard.writeText(text)
  toast.add({ title, icon: 'i-lucide-check' })
}
async function share() {
  const text = `Komatál a(z) ${k.value.name} részére. Itt tudsz csatlakozni:`
  if (navigator.share) await navigator.share({ title: 'Komatál', text, url: link.value }).catch(() => undefined)
  else await copy(`${text} ${link.value}`, 'Meghívó kimásolva')
}

const reservedBy = (uid: string) => ctx.slots.value.filter((s) => s.reservedBy === uid).length
const helperName = (uid: string) => ctx.contacts.value[uid]?.name || ctx.helperPublic.value[uid]?.name || 'Segítő'
async function kick(uid: string) {
  await removeHelper(k.value, uid).catch(() => toast.add({ title: 'Nem sikerült törölni', color: 'error' }))
}

// ---- birth ----
const birthOpen = ref(false)
const birthDate = ref(todayHu())
const defaultBirthText = () => `👶 Megszületett a baba! A ${k.value.name} komatálja elindult. Válassz napot, és írd meg, mit hozol.`
const birthText = ref('')
const busy = ref(false)
function openBirth() {
  birthText.value = defaultBirthText()
  birthOpen.value = true
}
async function born() {
  if (!ctx.key.value) return
  busy.value = true
  try {
    await markBorn(k.value, ctx.key.value, birthDate.value, birthText.value.trim())
    birthOpen.value = false
    toast.add({ title: 'Elindult, mindenki értesítést kap', icon: 'i-lucide-party-popper' })
  } catch {
    toast.add({ title: 'Nem sikerült elindítani', color: 'error' })
  } finally {
    busy.value = false
  }
}

// ---- settings ----
const extra = ref(3)
async function extend() {
  busy.value = true
  await extendDays(k.value, extra.value).catch(() => toast.add({ title: 'Nem sikerült bővíteni', color: 'error' }))
  busy.value = false
}
const closeOpen = ref(false)
const closeText = ref('')
function openClose() {
  closeText.value = 'Köszönjük a segítséget! A komatál lezárult.'
  closeOpen.value = true
}
async function close() {
  if (!ctx.key.value) return
  busy.value = true
  try {
    await closeKomatal(k.value, ctx.key.value, closeText.value.trim())
    closeOpen.value = false
  } catch {
    toast.add({ title: 'Nem sikerült lezárni', color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <div class="flex items-start justify-between gap-3">
        <h1 class="text-2xl font-extrabold text-highlighted">{{ k.name }}</h1>
        <UBadge
          :color="k.status === 'active' ? 'success' : k.status === 'waiting' ? 'warning' : 'neutral'"
          variant="subtle"
          :label="k.status === 'active' ? 'Folyamatban' : k.status === 'waiting' ? 'Várakozik' : 'Lezárva'"
        />
      </div>
      <p class="text-sm text-muted">
        <UIcon name="i-lucide-baby" class="mr-1 inline size-4 align-[-3px]" />
        {{ k.birthDate ? `Született: ${formatDay(k.birthDate)}` : `Várható születés: ${formatDay(k.dueDate)}` }}
      </p>
    </div>

    <UCard v-if="k.status === 'waiting'" class="ring-primary/40 bg-primary/5">
      <div class="space-y-3">
        <p class="text-sm text-toned">A segítők feliratkozhatnak a várólistára. Amikor megszületik a baba, egy gombnyomással mindenki értesítést kap, és napot foglalhat.</p>
        <UButton block size="lg" icon="i-lucide-baby" label="Baba megszületett" @click="openBirth" />
      </div>
    </UCard>
    <UAlert v-if="k.status === 'closed'" color="neutral" variant="subtle" icon="i-lucide-archive" title="Lezárt komatál" description="A segítők már nem látják a napokat. Te továbbra is megnézheted az archívumot." />

    <UTabs v-model="tab" :items="tabs" variant="pill" :content="false" class="w-full" :ui="{ trigger: 'flex-col gap-1 px-1 text-xs sm:flex-row sm:text-sm' }" />

    <section v-if="tab === 'calendar'" class="space-y-5">
      <UCard>
        <template #header>
          <h2 class="flex items-center gap-2 font-bold text-highlighted"><UIcon name="i-lucide-users" class="size-5 text-primary" />Várólista és segítők ({{ ctx.helpers.value.length }})</h2>
        </template>
        <p v-if="!ctx.helpers.value.length" class="text-sm text-muted">Még senki nem csatlakozott. Küldd el a meghívót a Meghívó fülön.</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="h in ctx.helpers.value" :key="h.uid" class="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">{{ helperName(h.uid) }}<span v-if="reservedBy(h.uid)" class="ml-2 font-normal text-muted">{{ reservedBy(h.uid) }} nap</span></p>
              <p class="flex flex-wrap gap-x-3 text-muted">
                <a v-if="ctx.contacts.value[h.uid]?.phone" :href="`tel:${ctx.contacts.value[h.uid]!.phone}`" class="text-primary underline">{{ ctx.contacts.value[h.uid]!.phone }}</a>
                <a v-if="ctx.contacts.value[h.uid]?.email" :href="`mailto:${ctx.contacts.value[h.uid]!.email}`" class="text-primary underline">{{ ctx.contacts.value[h.uid]!.email }}</a>
              </p>
            </div>
            <UButton v-if="k.status !== 'closed'" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" aria-label="Törlés a várólistáról" @click="kick(h.uid)" />
          </li>
        </ul>
      </UCard>
      <UCard>
        <template #header><h2 class="flex items-center gap-2 font-bold text-highlighted"><UIcon name="i-lucide-calendar-days" class="size-5 text-primary" />Napok</h2></template>
        <SlotList />
      </UCard>
    </section>

    <section v-else-if="tab === 'feed'" class="space-y-4">
      <PostComposer v-if="k.status !== 'closed'" />
      <PostFeed />
    </section>

    <section v-else-if="tab === 'invite'" class="space-y-4">
      <UAlert v-if="route.query.uj" color="success" variant="subtle" icon="i-lucide-party-popper" title="Kész a komatál!" description="Küldd el a linket a barátoknak. A jelszó benne van, nem kell külön megadniuk." />
      <UCard>
        <div class="space-y-4">
          <div class="flex items-center gap-2"><UIcon name="i-lucide-link" class="size-5 text-primary" /><h2 class="font-bold text-highlighted">Meghívó link</h2></div>
          <p class="break-all rounded-xl bg-muted p-3 font-mono text-sm text-toned select-all">{{ link }}</p>
          <div class="grid grid-cols-2 gap-2">
            <UButton icon="i-lucide-copy" color="neutral" variant="soft" label="Másolás" @click="copy(link)" />
            <UButton icon="i-lucide-share-2" label="Küldés" @click="share" />
          </div>
          <p class="text-sm text-muted">
            <UIcon name="i-lucide-shield-check" class="mr-1 inline size-4 align-[-3px]" />A jelszó a link <b>#</b> utáni része, ezt a szerver sosem kapja meg. Aki megkapja a linket, láthatja az adatokat.
          </p>
          <div class="flex items-center justify-between rounded-xl border border-default p-3 text-sm">
            <span class="text-muted">Jelszó</span>
            <button class="font-mono font-bold text-highlighted" @click="copy(ctx.password.value, 'Jelszó kimásolva')">{{ ctx.password.value }}</button>
          </div>
        </div>
      </UCard>
    </section>

    <section v-else class="space-y-4">
      <UCard v-if="k.status !== 'closed'">
        <template #header><h2 class="font-bold text-highlighted">Napok bővítése</h2></template>
        <div class="flex items-end gap-3">
          <UFormField :label="`Új napok (most ${k.dayCount}, legfeljebb ${MAX_DAYS})`" class="flex-1">
            <UInputNumber v-model="extra" :min="1" :max="MAX_DAYS - k.dayCount" class="w-full" />
          </UFormField>
          <UButton :loading="busy" :disabled="k.dayCount >= MAX_DAYS" label="Hozzáadás" @click="extend" />
        </div>
      </UCard>
      <UCard v-if="k.status === 'active'">
        <template #header><h2 class="font-bold text-highlighted">Komatál lezárása</h2></template>
        <p class="mb-3 text-sm text-muted">Lezáráskor a napok eltűnnek a segítők elől, mindenki értesítést kap, te pedig megnézheted az archívumot.</p>
        <UButton color="error" variant="soft" icon="i-lucide-archive" label="Komatál lezárása" @click="openClose" />
      </UCard>
    </section>

    <UModal v-model:open="birthOpen" title="Megszületett a baba" description="Ez a hír mindenkinek megjelenik, és értesítést kap a várólista.">
      <template #body>
        <form id="birth" class="space-y-4" @submit.prevent="born">
          <UFormField label="Születés napja" hint="az első nap másnap lesz"><UInput v-model="birthDate" type="date" class="w-full" required /></UFormField>
          <UFormField label="Hír a segítőknek"><UTextarea v-model="birthText" :rows="4" class="w-full" /></UFormField>
        </form>
      </template>
      <template #footer>
        <UButton type="submit" form="birth" :loading="busy" label="Közzététel és indítás" icon="i-lucide-party-popper" />
        <UButton color="neutral" variant="ghost" label="Mégse" @click="birthOpen = false" />
      </template>
    </UModal>

    <UModal v-model:open="closeOpen" title="Lezárod a komatált?" description="A napok eltűnnek a segítők elől. Akinek van foglalása, külön értesítést kap, hogy egyeztessen veled.">
      <template #body>
        <UFormField label="Záró hír"><UTextarea v-model="closeText" :rows="3" class="w-full" /></UFormField>
      </template>
      <template #footer>
        <UButton color="error" :loading="busy" label="Közzététel és lezárás" @click="close" />
        <UButton color="neutral" variant="ghost" label="Mégse" @click="closeOpen = false" />
      </template>
    </UModal>
  </div>
</template>
