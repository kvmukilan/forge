import { cn } from '@/lib/utils'
import {
  Target, CheckCircle, Flame, Zap, Star, Trophy, Coins, Gem, Gift, Lock
} from 'lucide-react'
import { AchievementDef } from '@/lib/gamification'

const ICONS: Record<string, React.ElementType> = {
  Target, CheckCircle, Flame, Zap, Star, Trophy, Coins, Gem, Gift,
}

interface AchievementBadgeProps {
  achievement: AchievementDef & { isUnlocked: boolean; unlockedAt?: string }
  className?: string
}

export default function AchievementBadge({ achievement, className }: AchievementBadgeProps) {
  const Icon = ICONS[achievement.iconName] ?? Star
  const { isUnlocked } = achievement

  return (
    <div className={cn(
      'glass-card p-4 flex flex-col items-center text-center gap-2 transition-all duration-300',
      isUnlocked ? 'opacity-100' : 'opacity-50 grayscale',
      className
    )}>
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center',
        isUnlocked ? 'border border-primary/35 bg-primary/10' : 'bg-muted border border-border'
      )}>
        <Icon className={cn('h-6 w-6', isUnlocked ? achievement.iconColor : 'text-muted-foreground')} />
      </div>
      <div>
        <p className={cn('font-semibold text-sm', isUnlocked ? '' : 'text-muted-foreground')}>
          {isUnlocked ? achievement.name : '???'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {isUnlocked ? achievement.description : 'Keep going to unlock'}
        </p>
      </div>
      {isUnlocked && achievement.unlockedAt && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium"><CheckCircle className="h-3.5 w-3.5" /> Unlocked</span>
      )}
      {!isUnlocked && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Locked</span>
      )}
    </div>
  )
}
