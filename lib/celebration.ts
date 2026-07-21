export type CelebrationScale = 'daily' | 'milestone'

export async function celebrate(scale: CelebrationScale = 'daily') {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const { default: confetti } = await import('canvas-confetti')
  const compact = window.innerWidth < 640
  const particleCount = scale === 'milestone'
    ? (compact ? 28 : 44)
    : (compact ? 12 : 20)

  confetti({
    particleCount,
    spread: scale === 'milestone' ? 55 : 38,
    startVelocity: scale === 'milestone' ? 24 : 16,
    gravity: 1.25,
    decay: 0.9,
    ticks: scale === 'milestone' ? 70 : 48,
    scalar: compact ? 0.65 : 0.8,
    origin: { y: 0.32 },
    colors: ['#8b5cf6', '#22d3ee', '#f59e0b'],
  })
}
