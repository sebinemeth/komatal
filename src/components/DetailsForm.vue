<script setup lang="ts">
import { FREQUENCIES } from '@/lib/schedule'
import { VISIT_LABELS, type Details, type VisitRule } from '@/lib/types'

const form = defineModel<{
  name: string
  dueDate: string
  dayCount: number
  everyNDays: number
  details: Details
}>({ required: true })

const visitItems = (Object.keys(VISIT_LABELS) as VisitRule[]).map((v) => ({ label: VISIT_LABELS[v], value: v }))
const frequencyItems = FREQUENCIES.map((f) => ({ label: f.label, value: f.value as number }))
</script>

<template>
  <div class="space-y-5">
    <UCard>
      <template #header><h2 class="font-bold text-highlighted">A család</h2></template>
      <div class="space-y-4">
        <UFormField label="Család neve" hint="a szerver látja, az értesítésekben szerepel">
          <UInput v-model="form.name" placeholder="pl. Kovács család" class="w-full" required />
        </UFormField>
        <UFormField label="Várható születés" hint="a szerver látja">
          <UInput v-model="form.dueDate" type="date" class="w-full" required />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header><h2 class="font-bold text-highlighted">Beosztás</h2></template>
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Napok száma" hint="később bővíthető">
          <UInputNumber v-model="form.dayCount" :min="1" :max="60" class="w-full" />
        </UFormField>
        <UFormField label="Gyakoriság">
          <USelect v-model="form.everyNDays" :items="frequencyItems" class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-bold text-highlighted">Átvétel</h2>
        <p class="text-sm text-muted"><UIcon name="i-lucide-lock" class="mr-1 inline size-3.5" />titkosított, foglalás után látszik</p>
      </template>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Ekkortól"><UInput v-model="form.details.deliveryFrom" type="time" class="w-full" /></UFormField>
          <UFormField label="Eddig"><UInput v-model="form.details.deliveryTo" type="time" class="w-full" /></UFormField>
        </div>
        <UFormField label="Bemehetnek babalátogatásra?">
          <USelect v-model="form.details.visit" :items="visitItems" class="w-full" />
        </UFormField>
        <UFormField label="Cím"><UInput v-model="form.details.address" placeholder="Város, utca, házszám" class="w-full" /></UFormField>
        <UFormField label="Egyéb megjegyzés" hint="kapukód, emelet, csengő…">
          <UTextarea v-model="form.details.notes" :rows="2" class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-bold text-highlighted">Étel</h2>
        <p class="text-sm text-muted"><UIcon name="i-lucide-lock" class="mr-1 inline size-3.5" />titkosított, foglalás után látszik</p>
      </template>
      <div class="space-y-4">
        <UFormField label="Allergia, kerülendő ételek"><UTextarea v-model="form.details.allergies" :rows="2" class="w-full" /></UFormField>
        <UFormField label="Kedvencek, preferenciák"><UTextarea v-model="form.details.preferences" :rows="2" class="w-full" /></UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-bold text-highlighted">Elérhetőséged</h2>
        <p class="text-sm text-muted"><UIcon name="i-lucide-lock" class="mr-1 inline size-3.5" />titkosított, foglalás után látszik</p>
      </template>
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Név"><UInput v-model="form.details.contactName" class="w-full" /></UFormField>
        <UFormField label="Telefon"><UInput v-model="form.details.contactPhone" type="tel" class="w-full" /></UFormField>
      </div>
    </UCard>
  </div>
</template>
