<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCtx } from '@/composables/ctx'
import { loadPostImages, setReaction, watchReactions } from '@/lib/api'
import { bytesToUrl } from '@/lib/images'
import { session } from '@/lib/session'
import { EMOJIS, type Post } from '@/lib/types'

const props = defineProps<{ post: Post; text: string }>()
const ctx = useCtx()
const reactions = ref<Record<string, string>>({})
const urls = ref<string[]>([])
let off: (() => void) | undefined

const counts = computed(() => {
  const out: Record<string, number> = {}
  Object.values(reactions.value).forEach((e) => (out[e] = (out[e] ?? 0) + 1))
  return out
})
const mine = computed(() => (session.user ? reactions.value[session.user.uid] : undefined))
const canReact = computed(() => !ctx.isOrganiserOf.value && ctx.komatal.value?.status !== 'closed')

onMounted(async () => {
  const k = ctx.komatal.value
  if (!k) return
  off = watchReactions(k.id, props.post.id, (r) => (reactions.value = r))
  if (props.post.imageCount && ctx.key.value) {
    const imgs = await loadPostImages(ctx.key.value, k.id, props.post.id, props.post.imageCount).catch(() => [])
    urls.value = imgs.map(bytesToUrl)
  }
})
onBeforeUnmount(() => {
  off?.()
  urls.value.forEach(URL.revokeObjectURL)
})

async function react(emoji: string) {
  const k = ctx.komatal.value
  if (!k || !session.user) return
  await setReaction(k, props.post.id, session.user.uid, mine.value === emoji ? null : emoji)
}

const when = computed(() =>
  new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' }).format(props.post.createdAt),
)
</script>

<template>
  <UCard :class="post.kind !== 'post' && 'ring-primary/40 bg-primary/5'">
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon :name="post.kind === 'birth' ? 'i-lucide-party-popper' : post.kind === 'close' ? 'i-lucide-heart-handshake' : 'i-lucide-newspaper'" class="size-4 text-primary" />
        <span>{{ when }}</span>
      </div>
      <p class="whitespace-pre-line text-highlighted">{{ text }}</p>
      <div v-if="urls.length" class="grid gap-2" :class="urls.length > 1 ? 'grid-cols-2' : ''">
        <img v-for="(u, i) in urls" :key="i" :src="u" alt="" class="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />
      </div>
      <div class="flex flex-wrap gap-2">
        <template v-if="canReact">
          <UButton
            v-for="e in EMOJIS"
            :key="e"
            size="sm"
            :variant="mine === e ? 'soft' : 'outline'"
            :color="mine === e ? 'primary' : 'neutral'"
            @click="react(e)"
          >
            {{ e }} <span v-if="counts[e]" class="text-xs">{{ counts[e] }}</span>
          </UButton>
        </template>
        <template v-else>
          <UBadge v-for="(n, e) in counts" :key="e" color="neutral" variant="subtle" size="lg">{{ e }} {{ n }}</UBadge>
        </template>
      </div>
    </div>
  </UCard>
</template>
