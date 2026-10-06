<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { useCtx } from '@/composables/ctx'
import { joinAsHelper } from '@/lib/api'
import { session } from '@/lib/session'

const emit = defineEmits<{ done: [] }>()
const ctx = useCtx()
const toast = useToast()
const busy = ref(false)
const editing = computed(() => !!ctx.myHelper.value)
const mine = computed(() => (session.user ? ctx.helperPublic.value[session.user.uid] : undefined))

const form = reactive({
  name: mine.value?.name ?? '',
  phone: '',
  email: '',
  nameVisible: mine.value?.nameVisible ?? true,
  emailOptIn: true,
})

const valid = computed(() => form.name.trim() && (form.phone.trim() || form.email.trim()))

async function submit() {
  const k = ctx.komatal.value
  if (!k || !ctx.key.value || !session.user || !valid.value) return
  busy.value = true
  try {
    await joinAsHelper(k, ctx.key.value, session.user.uid, { ...form, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() }, ctx.myHelper.value)
    try {
      localStorage.setItem(`komatal:email:${k.id}`, form.email.trim() && form.emailOptIn ? '1' : '0')
    } catch { /* ignore */ }
    emit('done')
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Nem sikerült csatlakozni', description: 'Próbáld újra egy pillanat múlva.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <h2 class="font-bold text-highlighted">{{ editing ? 'Adataid módosítása' : 'Csatlakozom segítőnek' }}</h2>
        <p v-if="!editing" class="text-sm text-muted">Szülés előtt a várólistára iratkozol fel. Napot a baba megszületése után foglalhatsz.</p>
        <p v-else class="text-sm text-muted">Az elérhetőséged titkosított, ezért módosításkor újra be kell írnod.</p>
      </div>
      <UFormField label="Neved"><UInput v-model="form.name" autocomplete="name" class="w-full" required /></UFormField>
      <UFormField label="Telefonszám" hint="telefon vagy e-mail kötelező"><UInput v-model="form.phone" type="tel" autocomplete="tel" class="w-full" /></UFormField>
      <UFormField label="E-mail cím"><UInput v-model="form.email" type="email" autocomplete="email" class="w-full" /></UFormField>
      <div class="space-y-2">
        <UCheckbox v-model="form.nameVisible" label="A nevem látszódjon a többi segítőnek" description="Ha kikapcsolod, vicces becenevet kapsz, pl. Névtelen Nyuszi." />
        <UCheckbox v-model="form.emailOptIn" :disabled="!form.email" label="E-mailben is kérek értesítést" />
      </div>
      <p class="text-xs text-muted"><UIcon name="i-lucide-eye-off" class="mr-1 inline size-3.5" />Az elérhetőségedet csak a szervező látja, a többi segítő soha.</p>
      <UButton type="submit" block :loading="busy" :disabled="!valid" :label="editing ? 'Mentés' : 'Feliratkozom'" />
    </form>
  </UCard>
</template>
