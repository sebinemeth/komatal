<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@nuxt/ui/composables'
import { createKomatal } from '@/lib/api'
import { generatePassword } from '@/lib/crypto'
import { addDays, todayHu } from '@/lib/schedule'
import { rememberKomatalPassword, session, vault } from '@/lib/session'
import DetailsForm from '@/components/DetailsForm.vue'
import UnlockPanel from '@/components/UnlockPanel.vue'

const router = useRouter()
const toast = useToast()
const busy = ref(false)
const form = reactive({
  name: '',
  dueDate: addDays(todayHu(), 30),
  dayCount: 12,
  everyNDays: 1,
  details: {
    deliveryFrom: '17:00',
    deliveryTo: '19:00',
    visit: 'ask' as const,
    allergies: '',
    preferences: '',
    address: '',
    notes: '',
    contactName: '',
    contactPhone: '',
  },
})

async function submit() {
  if (!vault.content || !session.user) return
  busy.value = true
  try {
    const password = generatePassword()
    const id = await createKomatal(form, { password, orgPub: vault.content.orgPublicJwk, uid: session.user.uid })
    await rememberKomatalPassword(id, password)
    router.replace({ path: `/k/${id}`, query: { uj: '1' } })
  } catch (e) {
    console.error(e)
    toast.add({ title: 'Nem sikerült létrehozni a komatált', description: 'Ellenőrizd a kapcsolatot, és próbáld újra.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-extrabold text-highlighted">Új komatál</h1>
    <UnlockPanel />
    <form v-if="vault.status === 'ready'" class="space-y-5" @submit.prevent="submit">
      <DetailsForm v-model="form" />
      <UButton type="submit" size="lg" block :loading="busy" icon="i-lucide-sparkles" label="Létrehozás" />
    </form>
  </div>
</template>
