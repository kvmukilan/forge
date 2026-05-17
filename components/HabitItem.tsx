import { Habit, User } from '@/lib/types'
import { useAtom, useAtomValue } from 'jotai'
import { settingsAtom, browserSettingsAtom, usersAtom, currentUserAtom } from '@/lib/atoms'
import { habitStreaksAtom } from '@/lib/gamification-atoms'
import { calculateHabitXP, getBestStreak, getCompletionRate30Days } from '@/lib/gamification'
import { getCompletionsForToday, isTaskOverdue, convertMachineReadableFrequencyToHumanReadable } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Check, Undo2, MoreVertical, Pin, ChevronDown, ChevronUp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEffect, useState } from 'react'
import { useHabits } from '@/hooks/useHabits'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { hasPermission } from '@/lib/utils'
import { HabitContextMenuItems } from './HabitContextMenuItems'
import DrawingDisplay from './DrawingDisplay'
import HabitHeatmap from './HabitHeatmap'
import { cn } from '@/lib/utils'
import { DateTime } from 'luxon'

interface HabitItemProps {
  habit: Habit
  onEdit: () => void
  onDelete: () => void
}

const renderUserAvatars = (habit: Habit, currentUser: User | null, usersData: { users: User[] }) => {
  if (!habit.userIds || habit.userIds.length <= 1) return null;

  return (
    <div className="flex -space-x-2 ml-2 flex-shrink-0">
      {habit.userIds?.filter((u) => u !== currentUser?.id).map(userId => {
        const user = usersData.users.find(u => u.id === userId)
        if (!user) return null
        return (
          <Avatar key={user.id} className="h-6 w-6">
            <AvatarImage src={user?.avatarPath && `/api/avatars/${user.avatarPath.split('/').pop()}` || ""} />
            <AvatarFallback>{user.username[0]}</AvatarFallback>
          </Avatar>
        )
      })}
    </div>
  );
};


export default function HabitItem({ habit, onEdit, onDelete }: HabitItemProps) {
  const { completeHabit, undoComplete } = useHabits()
  const [settings] = useAtom(settingsAtom)
  const completionsToday = getCompletionsForToday({ habit, timezone: settings.system.timezone })
  const target = habit.targetCompletions || 1
  const isCompletedToday = completionsToday >= target
  const [isHighlighted, setIsHighlighted] = useState(false)
  const t = useTranslations('HabitItem');
  const [usersData] = useAtom(usersAtom)
  const [currentUser] = useAtom(currentUserAtom)
  const canWrite = hasPermission(currentUser, 'habit', 'write')
  const canInteract = hasPermission(currentUser, 'habit', 'interact')
  const [browserSettings] = useAtom(browserSettingsAtom)
  const isTasksView = browserSettings.viewType === 'tasks'
  const habitStreaks = useAtomValue(habitStreaksAtom)
  const streak = habitStreaks.get(habit.id) ?? 0
  const xpReward = calculateHabitXP(habit)
  const [expanded, setExpanded] = useState(false)
  const bestStreak = getBestStreak(habit, settings.system.timezone)
  const completionRate = getCompletionRate30Days(habit, settings.system.timezone)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const highlightId = params.get('highlight')

    if (highlightId === habit.id) {
      setIsHighlighted(true)
      setTimeout(() => {
        const element = document.getElementById(`habit-${habit.id}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      const timer = setTimeout(() => setIsHighlighted(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [habit.id])

  // Tasks keep the existing row style
  if (habit.isTask) {
    return (
      <div
        id={`habit-${habit.id}`}
        className={cn(
          'vault-row group',
          isHighlighted && 'ring-1 ring-amber-400',
          habit.archived && 'opacity-40',
        )}
      >
        {/* Complete button - square checkbox */}
        <button
          onClick={() => !isCompletedToday ? completeHabit(habit) : undefined}
          disabled={!canInteract || habit.archived}
          className={cn(
            'h-6 w-6 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
            isCompletedToday
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-white/20 hover:border-white/60'
          )}
        >
          {isCompletedToday && <Check className="h-3.5 w-3.5 text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {habit.pinned && <Pin className="h-3 w-3 text-amber-400 flex-shrink-0" />}
            <h3 className={cn(
              'font-bold text-base leading-tight',
              isCompletedToday && 'line-through text-muted-foreground'
            )}>
              {habit.name}
            </h3>
            {isTaskOverdue(habit, settings.system.timezone) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wider">{t('overdue')}</span>
            )}
            {isCompletedToday && (
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">logged</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="section-label">
              {convertMachineReadableFrequencyToHumanReadable({ frequency: habit.frequency, isRecurRule: !habit.isTask, timezone: settings.system.timezone })}
            </span>
            <span className="section-label text-amber-400/60">🪙 {habit.coinReward}</span>
            <span className="section-label text-violet-400/60">⚡ +{xpReward} XP</span>
          </div>
          {(habit.intentionWhen || habit.intentionWhere) && (
            <p className="text-[11px] text-muted-foreground/50 italic mt-0.5">
              {[habit.intentionWhen && `⏰ ${habit.intentionWhen}`, habit.intentionWhere && `📍 ${habit.intentionWhere}`].filter(Boolean).join(' · ')}
            </p>
          )}
          {habit.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{habit.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {completionsToday > 0 && !habit.archived && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => undoComplete(habit)} disabled={!canWrite}>
              <Undo2 className="h-3 w-3" />
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <HabitContextMenuItems habit={habit} onEditRequest={onEdit} onDeleteRequest={onDelete} context="habit-item" />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // Habits — new card design
  return (
    <div
      id={`habit-${habit.id}`}
      className={cn(
        'group relative rounded-lg border bg-[#161616] border-[#262626] p-5 transition-all duration-200 hover:border-[#333]',
        isCompletedToday && 'opacity-50',
        isHighlighted && 'border-primary/50',
        habit.archived && 'opacity-40',
        habit.isKeystone && 'border-l-[3px] border-l-primary'
      )}
    >
      {/* Top row: badges + actions */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {habit.isKeystone && (
            <span className="text-[10px] text-primary font-bold uppercase tracking-wide">⭐ Keystone</span>
          )}
          {habit.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
          {habit.difficulty && (
            <span className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              habit.difficulty === 'hard' ? 'bg-red-500' :
              habit.difficulty === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            )} />
          )}
          {isTaskOverdue(habit, settings.system.timezone) && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wider">{t('overdue')}</span>
          )}
        </div>

        {/* Actions dropdown — hidden until hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {completionsToday > 0 && !habit.archived && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              onClick={() => undoComplete(habit)}
              disabled={!canWrite}
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground transition-all">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <HabitContextMenuItems habit={habit} onEditRequest={onEdit} onDeleteRequest={onDelete} context="habit-item" />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Habit name */}
      <h3 className={cn(
        'text-base font-bold mb-4 leading-snug',
        isCompletedToday && 'line-through text-muted-foreground'
      )}>
        {habit.name}
      </h3>

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="section-label">
          {convertMachineReadableFrequencyToHumanReadable({ frequency: habit.frequency, isRecurRule: true, timezone: settings.system.timezone })}
        </span>
        <span className="section-label text-amber-400/60">🪙 {habit.coinReward}</span>
        <span className="section-label text-violet-400/60">⚡ +{xpReward} XP</span>
      </div>

      {/* Bottom: streak + mini bars */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Current Streak</p>
          <p className={cn(
            'text-5xl font-black tabular-nums leading-none',
            isCompletedToday ? 'text-muted-foreground' : 'text-primary'
          )}>
            {String(streak).padStart(2, '0')}
          </p>
        </div>

        {/* Mini 7-day activity bars */}
        <div className="flex gap-0.5 items-end">
          {Array.from({ length: 7 }).map((_, i) => {
            const dayStr = DateTime.now().setZone(settings.system.timezone).minus({ days: 6 - i }).toISODate()!
            const count = habit.completions.filter(c =>
              DateTime.fromISO(c).setZone(settings.system.timezone).toISODate() === dayStr
            ).length
            const filled = count >= (habit.targetCompletions ?? 1)
            return (
              <div
                key={i}
                className={cn(
                  'w-4 rounded-sm transition-colors',
                  filled ? 'bg-primary h-6' : 'bg-[#2a2a2a] h-3'
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Complete button */}
      <button
        onClick={() => isCompletedToday ? undoComplete(habit) : completeHabit(habit)}
        disabled={!canInteract || habit.archived}
        className={cn(
          'w-full py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all',
          isCompletedToday
            ? 'bg-[#2a2a2a] text-muted-foreground hover:bg-[#333]'
            : 'bg-primary text-black hover:bg-primary/90'
        )}
      >
        {isCompletedToday
          ? 'Completed ✓'
          : `Complete${target > 1 ? ` (${completionsToday}/${target})` : ''}`
        }
      </button>

      {/* Expandable stats */}
      <div className="mt-3">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 section-label hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          {expanded ? 'hide stats' : 'stats'}
        </button>
        {expanded && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-4">
              <span className="section-label">Best: <span className="text-foreground">{bestStreak}d</span></span>
              <span className="section-label">30d: <span className="text-foreground">{completionRate}%</span></span>
            </div>
            <HabitHeatmap habit={habit} timezone={settings.system.timezone} />
          </div>
        )}
      </div>

      {/* Intention */}
      {(habit.intentionWhen || habit.intentionWhere) && (
        <p className="text-[11px] text-muted-foreground/50 italic mt-2">
          {[habit.intentionWhen && `⏰ ${habit.intentionWhen}`, habit.intentionWhere && `📍 ${habit.intentionWhere}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Drawing */}
      {habit.drawing && (
        <div className="mt-2">
          <DrawingDisplay drawingData={habit.drawing} width={120} height={80} className="" />
        </div>
      )}

      {/* User avatars */}
      {renderUserAvatars(habit, currentUser as User, usersData) && (
        <div className="mt-2 flex gap-1">
          {renderUserAvatars(habit, currentUser as User, usersData)}
        </div>
      )}

      {/* Description */}
      {habit.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{habit.description}</p>
      )}
    </div>
  )
}
