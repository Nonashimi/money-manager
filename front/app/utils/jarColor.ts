function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(ch => ch + ch).join('') : value
  const num = Number.parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  const channel = (i: number) => Math.round(a[i]! * (1 - amount) + b[i]! * amount)
  return `#${[0, 1, 2].map(i => channel(i).toString(16).padStart(2, '0')).join('')}`
}

/** The felt "fabric" colour of a jar: its own colour pulled toward the dark canvas so it never glares. */
export function jarFabric(hex: string | null | undefined): string {
  return mix(hex || '#6366f1', '#0b0d12', 0.42)
}

/** The stitched zig-zag colour: a light tint of the same hue, so any picked colour gets a matching pair. */
export function jarStitch(hex: string | null | undefined): string {
  return mix(hex || '#6366f1', '#ffffff', 0.55)
}

export function jarRugStyle(hex: string | null | undefined) {
  return { '--rug-c': jarFabric(hex), '--rug-a': jarStitch(hex) }
}
