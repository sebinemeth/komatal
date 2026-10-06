<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { useCtx } from '@/composables/ctx'
import { createPost } from '@/lib/api'
import { MAX_IMAGES, bytesToUrl, resizeToJpeg } from '@/lib/images'

const ctx = useCtx()
const toast = useToast()
const text = ref('')
const images = ref<{ bytes: Uint8Array<ArrayBuffer>; url: string }[]>([])
const busy = ref(false)
const input = ref<HTMLInputElement>()

async function pick(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []).slice(0, MAX_IMAGES - images.value.length)
  for (const f of files) {
    try {
      const bytes = await resizeToJpeg(f)
      images.value.push({ bytes, url: bytesToUrl(bytes) })
    } catch {
      toast.add({ title: 'Ezt a képet nem sikerült feldolgozni', color: 'warning' })
    }
  }
  if (input.value) input.value.value = ''
}

function drop(i: number) {
  URL.revokeObjectURL(images.value[i]!.url)
  images.value.splice(i, 1)
}

async function submit() {
  const k = ctx.komatal.value
  if (!k || !ctx.key.value || (!text.value.trim() && !images.value.length)) return
  busy.value = true
  try {
    await createPost(k, ctx.key.value, text.value.trim(), images.value.map((i) => i.bytes))
    text.value = ''
    images.value.forEach((i) => URL.revokeObjectURL(i.url))
    images.value = []
  } catch {
    toast.add({ title: 'Nem sikerült közzétenni', color: 'error' })
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => images.value.forEach((i) => URL.revokeObjectURL(i.url)))
</script>

<template>
  <UCard>
    <form class="space-y-3" @submit.prevent="submit">
      <UTextarea v-model="text" :rows="3" placeholder="Mi újság? Írj a segítőknek…" class="w-full" autoresize />
      <div v-if="images.length" class="flex gap-2 overflow-x-auto">
        <div v-for="(im, i) in images" :key="im.url" class="relative shrink-0">
          <img :src="im.url" alt="" class="size-20 rounded-xl object-cover" />
          <UButton icon="i-lucide-x" size="xs" color="neutral" class="absolute -right-1 -top-1 rounded-full" aria-label="Kép törlése" @click="drop(i)" />
        </div>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <input ref="input" type="file" accept="image/*" multiple class="hidden" @change="pick" />
          <UButton icon="i-lucide-image-plus" color="neutral" variant="soft" :disabled="images.length >= MAX_IMAGES" :label="`Kép (${images.length}/${MAX_IMAGES})`" @click="input?.click()" />
        </div>
        <UButton type="submit" icon="i-lucide-send" label="Közzététel" :loading="busy" :disabled="!text.trim() && !images.length" />
      </div>
    </form>
  </UCard>
</template>
