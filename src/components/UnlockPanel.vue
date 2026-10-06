<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { unlockWithPassword, unlockWithRecovery, vault } from '@/lib/session'

const toast = useToast()
const password = ref('')
const code = ref('')
const recover = ref(false)
const busy = ref(false)

async function submit() {
  busy.value = true
  try {
    if (recover.value) await unlockWithRecovery(code.value, password.value)
    else await unlockWithPassword(password.value)
  } catch {
    toast.add({ title: recover.value ? 'A helyreállító kód nem jó' : 'A jelszó nem jó', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard v-if="vault.status === 'locked'">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="flex items-center gap-3">
        <span class="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><UIcon name="i-lucide-key-round" class="size-6" /></span>
        <div>
          <h2 class="font-bold text-highlighted">Oldd fel a titkosított adataidat</h2>
          <p class="text-sm text-muted">Ezen az eszközön még nem adtad meg a jelszavad.</p>
        </div>
      </div>
      <UFormField :label="recover ? 'Jelenlegi belépési jelszavad' : 'Belépési jelszavad'">
        <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" required />
      </UFormField>
      <UFormField v-if="recover" label="Helyreállító kód" hint="xxxx-xxxx-xxxx-xxxx">
        <UInput v-model="code" class="w-full font-mono" required />
      </UFormField>
      <UButton type="submit" block :loading="busy" :label="recover ? 'Visszaállítás' : 'Feloldás'" />
      <button type="button" class="w-full text-center text-sm text-muted underline" @click="recover = !recover">
        {{ recover ? 'Mégis a jelszavammal oldom fel' : 'Elfelejtettem a régi jelszavam' }}
      </button>
    </form>
  </UCard>
</template>
