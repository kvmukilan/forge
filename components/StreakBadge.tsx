import { cn } from '@/lib/utils'

interface StreakBadgeProps {
  streak: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function StreakBadge({ streak, className, size = 'md' }: StreakBadgeProps) {
  if (streak === 0) return null

  const isHot = streak >= 7
  const isOnFire = streak >= 30

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-1 gap-1',
    lg: 'text-base px-3 py-1.5 gap-1.5',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        'bg-orange-500/15 text-orange-400 border border-orange-500/20',
        isHot && 'bg-orange-500/25 border-orange-500/40',
        isOnFire && 'bg-red-500/25 text-red-400 border-red-500/40',
        sizeClasses[size],
        className
      )}
    >
      <span className={cn(isHot && 'animate-streak-pulse', isOnFire && 'streak-glow')}>
        🔥
      </span>
      <span>{streak}</span>
    </span>
  )
}
