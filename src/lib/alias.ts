// Funny aliases for helpers who hide their name, like "Névtelen Nyuszi".
const ADJ = ['Névtelen', 'Kék', 'Vidám', 'Álmos', 'Bátor', 'Csendes', 'Derűs', 'Finom', 'Gyors', 'Habos', 'Kedves', 'Lusta', 'Mókás', 'Nagyvonalú', 'Pihe-puha', 'Szórakozott']
const ANIMAL = ['Nyuszi', 'Kecske', 'Vidra', 'Pingvin', 'Sün', 'Bagoly', 'Mókus', 'Teknős', 'Lajhár', 'Panda', 'Borz', 'Őz', 'Cinege', 'Pillangó', 'Medve', 'Hód']

export function randomAlias(): string {
  const r = crypto.getRandomValues(new Uint8Array(2))
  return `${ADJ[r[0]! % ADJ.length]} ${ANIMAL[r[1]! % ANIMAL.length]}`
}
