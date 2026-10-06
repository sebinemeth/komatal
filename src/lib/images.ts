// Pictures are resized in the browser, then encrypted before upload.
export const MAX_IMAGES = 5
export const MAX_SIDE = 1600

export async function resizeToJpeg(file: File): Promise<Uint8Array<ArrayBuffer>> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q))
    if (blob && blob.size < 550_000) return new Uint8Array(await blob.arrayBuffer())
  }
  throw new Error('Túl nagy kép')
}

export function bytesToUrl(bytes: Uint8Array<ArrayBuffer> | Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }))
}
