import { inject, type InjectionKey } from 'vue'
import type { useKomatal } from './useKomatal'

export type KomatalCtx = ReturnType<typeof useKomatal>
export const KomatalCtxKey: InjectionKey<KomatalCtx> = Symbol('komatal')

export function useCtx(): KomatalCtx {
  const c = inject(KomatalCtxKey)
  if (!c) throw new Error('KomatalCtx missing')
  return c
}
