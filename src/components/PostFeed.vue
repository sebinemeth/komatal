<script setup lang="ts">
import { useCtx } from '@/composables/ctx'
import PostCard from './PostCard.vue'

const ctx = useCtx()
</script>

<template>
  <div class="space-y-3">
    <PostCard v-for="p in ctx.posts.value" :key="p.id" :post="p" :text="ctx.postBodies.value[p.id]?.text ?? '…'" />
    <UCard v-if="!ctx.posts.value.length" class="text-center">
      <p class="py-3 text-sm text-muted">Még nincs hír. A szülők híreit itt látod majd.</p>
    </UCard>
  </div>
</template>
