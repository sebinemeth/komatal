<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { useCtx } from '@/composables/ctx'
import { cancelSlot, reserveSlot } from '@/lib/api'
import { formatDay } from '@/lib/schedule'
import { session } from '@/lib/session'
import { VISIT_LABELS, type Slot } from '@/lib/types'
import JoinForm from './JoinForm.vue'
import NotifyCard from './NotifyCard.vue'
import PostFeed from './PostFeed.vue'

const ctx = useCtx()
const toast = useToast()
const k = computed(() => ctx.komatal.value!)
const uid = computed(() => session.user?.uid ?? '')
const joined = computed(() => !!ctx.myHelper.value)
const mySlots = computed(() => ctx.slots.value.filter((s) => s.reservedBy === uid.value))
const me = computed(() => ctx.helperPublic.value[uid.value])
const editing = ref(false)

const picking = ref<Slot | null>(null)
const meal = ref('')
const note = ref('')
const busy = ref(false)
function pick(s: Slot) {
  picking.value = s
  meal.value = ''
  note.value = ''
}
async function reserve() {
  if (!picking.value || !ctx.key.value || !me.value) return
  busy.value = true
  try {
    await reserveSlot(k.value, ctx.key.value, uid.value, picking.value.index, { meal: meal.value.trim(), note: note.value.trim() }, me.value.nameVisible ? me.value.name : me.value.alias)
    toast.add({ title: 'Foglalva, köszönjük!', icon: 'i-lucide-heart' })
    picking.value = null
  } catch {
    toast.add({ title: 'Ezt a napot épp most más foglalta le', color: 'warning', icon: 'i-lucide-circle-alert' })
    picking.value = null
  } finally {
    busy.value = false
  }
}
async function giveBack(s: Slot) {
  await cancelSlot(k.value, s.index).catch(() => toast.add({ title: 'Nem sikerült lemondani', color: 'error' }))
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <div class="flex items-start justify-between gap-3">
        <h1 class="text-2xl font-extrabold text-highlighted">{{ k.name }} komatálja</h1>
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

    <UAlert v-if="k.status === 'closed'" color="neutral" variant="subtle" icon="i-lucide-heart-handshake" title="Ez a komatál lezárult" description="Köszönjük a segítséget! Ha van még foglalásod, egyeztess a szervezővel." />

    <template v-else>
      <JoinForm v-if="!joined || editing" @done="editing = false" />

      <template v-else>
        <UCard v-if="k.status === 'waiting'" class="ring-primary/40 bg-primary/5">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-hourglass" class="mt-0.5 size-6 shrink-0 text-primary" />
            <div>
              <p class="font-bold text-highlighted">A várólistán vagy{{ me ? `, ${me.nameVisible ? me.name : me.alias}` : '' }}</p>
              <p class="text-sm text-muted">Amint megszületik a baba, értesítünk, és napot választhatsz.</p>
              <button class="mt-1 text-sm text-primary underline" @click="editing = true">Adataim módosítása</button>
            </div>
          </div>
        </UCard>

        <NotifyCard />

        <UCard v-if="k.status === 'active'">
          <template #header>
            <h2 class="flex items-center gap-2 font-bold text-highlighted"><UIcon name="i-lucide-calendar-days" class="size-5 text-primary" />Válassz napot</h2>
          </template>
          <div class="divide-y divide-default">
            <div v-for="s in ctx.slots.value" :key="s.index" class="flex items-center gap-3 py-3" :class="s.reservedBy === uid && 'rounded-xl bg-primary/5 px-2'">
              <div class="w-16 shrink-0 text-center">
                <p class="font-extrabold text-highlighted">{{ s.index + 1 }}. nap</p>
                <p v-if="s.date" class="text-xs text-muted">{{ formatDay(s.date, { month: 'short', day: 'numeric' }) }}</p>
              </div>
              <div class="min-w-0 flex-1 text-sm">
                <template v-if="s.status === 'reserved'">
                  <p class="font-semibold text-highlighted">{{ ctx.slotData.value[s.index]?.label || 'Segítő' }}<span v-if="s.reservedBy === uid" class="ml-1 text-primary">(te)</span></p>
                  <p class="text-toned">{{ ctx.slotData.value[s.index]?.meal }}</p>
                  <p v-if="s.reservedBy === uid && ctx.slotData.value[s.index]?.note" class="text-muted"><UIcon name="i-lucide-clock" class="mr-1 inline size-3.5" />{{ ctx.slotData.value[s.index]?.note }}</p>
                </template>
                <p v-else class="text-muted">Szabad nap</p>
              </div>
              <UButton v-if="s.status === 'free'" size="sm" label="Vállalom" @click="pick(s)" />
              <UButton v-else-if="s.reservedBy === uid" size="xs" color="neutral" variant="ghost" icon="i-lucide-undo-2" aria-label="Lemondom" @click="giveBack(s)" />
            </div>
          </div>
        </UCard>

        <UCard v-if="mySlots.length && ctx.details.value">
          <template #header>
            <h2 class="flex items-center gap-2 font-bold text-highlighted"><UIcon name="i-lucide-lock-open" class="size-5 text-primary" />Tudnivalók a vállalt napra</h2>
          </template>
          <dl class="space-y-3 text-sm">
            <div v-if="ctx.details.value.deliveryFrom"><dt class="text-muted">Átvétel</dt><dd class="font-semibold text-highlighted">{{ ctx.details.value.deliveryFrom }}–{{ ctx.details.value.deliveryTo }}, {{ VISIT_LABELS[ctx.details.value.visit] }}</dd></div>
            <div v-if="ctx.details.value.address"><dt class="text-muted">Cím</dt><dd class="font-semibold text-highlighted">{{ ctx.details.value.address }}</dd></div>
            <div v-if="ctx.details.value.notes"><dt class="text-muted">Megjegyzés</dt><dd class="text-highlighted">{{ ctx.details.value.notes }}</dd></div>
            <div v-if="ctx.details.value.allergies"><dt class="text-muted">Allergia, kerülendő</dt><dd class="text-highlighted">{{ ctx.details.value.allergies }}</dd></div>
            <div v-if="ctx.details.value.preferences"><dt class="text-muted">Kedvencek</dt><dd class="text-highlighted">{{ ctx.details.value.preferences }}</dd></div>
            <div v-if="ctx.details.value.contactName || ctx.details.value.contactPhone">
              <dt class="text-muted">Szervező</dt>
              <dd class="text-highlighted">{{ ctx.details.value.contactName }} <a v-if="ctx.details.value.contactPhone" :href="`tel:${ctx.details.value.contactPhone}`" class="text-primary underline">{{ ctx.details.value.contactPhone }}</a></dd>
            </div>
          </dl>
        </UCard>
        <UAlert v-else-if="k.status === 'active' && !mySlots.length" color="neutral" variant="subtle" icon="i-lucide-lock" description="A cím, az allergiák és az átvétel részletei akkor jelennek meg, amikor napot foglalsz." />
      </template>
    </template>

    <div class="space-y-3">
      <h2 class="flex items-center gap-2 font-bold text-highlighted"><UIcon name="i-lucide-newspaper" class="size-5 text-primary" />Hírek</h2>
      <PostFeed />
    </div>

    <UModal :open="!!picking" :title="picking ? `${picking.index + 1}. nap${picking.date ? ` · ${formatDay(picking.date)}` : ''}` : ''" description="Írd meg, mit hozol. Az étel mindenkinek látszik." @update:open="(v: boolean) => !v && (picking = null)">
      <template #body>
        <form id="reserve" class="space-y-4" @submit.prevent="reserve">
          <UFormField label="Mit hozol?"><UInput v-model="meal" placeholder="pl. Pörkölt galuskával" class="w-full" required /></UFormField>
          <UFormField label="Megjegyzés" hint="pl. érkezési idő, csak a szervező látja"><UTextarea v-model="note" :rows="2" placeholder="Kb. 18:00-kor érkezem" class="w-full" /></UFormField>
        </form>
      </template>
      <template #footer>
        <UButton type="submit" form="reserve" :loading="busy" label="Foglalás" icon="i-lucide-check" />
        <UButton color="neutral" variant="ghost" label="Mégse" @click="picking = null" />
      </template>
    </UModal>
  </div>
</template>
