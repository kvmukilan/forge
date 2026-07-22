import { Habit, User } from '@/lib/types'
import { useAtom, useAtomValue } from 'jotai'
import { settingsAtom, browserSettingsAtom, usersAtom, currentUserAtom } from '@/lib/atoms'
import { habitStreaksAtom } from '@/lib/gamification-atoms'
import { calculateHabitXP, getBestStreak, getCompletionRate30Days } from '@/lib/gamification'
import { getCompletionsForToday, isTaskOverdue, convertMachineReadableFrequencyToHumanReadable } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Check, Undo2, MoreVertical, Pin, ChevronDown, ChevronUp, Coins, Zap, Star, Clock, MapPin } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEffect, useState } from 'react'
import { useHabits } from '@/hooks/useHabits'
import { useSwipeComplete } from '@/hooks/useSwipeComplete'
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
  const scheduleLabel = convertMachineReadableFrequencyToHumanReadable({
    frequency: habit.frequency,
    isRecurRule: !habit.isTask,
    timezone: settings.system.timezone,
  })
  const sharedAvatars = renderUserAvatars(habit, currentUser ?? null, usersData)

  // Touch swipe: right completes, left undoes (mobile quick-log)
  const { offset, swiping, handlers: swipeHandlers } = useSwipeComplete({
    onSwipeRight: !isCompletedToday && canInteract && !habit.archived ? () => completeHabit(habit) : undefined,
    onSwipeLeft: completionsToday > 0 && canWrite && !habit.archived ? () => undoComplete(habit) : undefined,
    disabled: habit.archived || (!canInteract && !canWrite),
  })
  const swipeStyle = {
    transform: offset !== 0 ? `translateX(${offset}px)` : undefined,
    transition: swiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    touchAction: 'pan-y' as const,
  }

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
          isHighlighted && 'ring-1 ring-primary',
          habit.archived && 'opacity-40',
          offset > 0 && 'border-primary/50',
        )}
        style={swipeStyle}
        {...swipeHandlers}
      >
        {/* Complete button - square checkbox */}
        <button
          onClick={() => !isCompletedToday ? completeHabit(habit) : undefined}
          disabled={!canInteract || habit.archived}
          aria-label={isCompletedToday ? `${habit.name} completed` : `Complete ${habit.name}`}
          className={cn(
            'min-h-11 min-w-11 rounded-xl border-2 flex-shrink-0 flex items-center justify-center transition-all',
            isCompletedToday
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-border hover:border-muted-foreground'
          )}
        >
          {isCompletedToday && <Check className="h-3.5 w-3.5 text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {habit.pinned && <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            <h3 className={cn(
              'font-bold text-base leading-tight',
              isCompletedToday && 'line-through text-muted-foreground'
            )}>
              {habit.name}
            </h3>
            {isTaskOverdue(habit, settings.system.timezone) && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-destructive/20 text-red-400 uppercase tracking-wider">{t('overdue')}</span>
            )}
            {isCompletedToday && (
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">logged</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="section-label">{scheduleLabel}</span>
            <span className="section-label text-amber-400/60 flex items-center gap-1"><Coins className="h-3 w-3" />{habit.coinReward}</span>
            <span className="section-label flex items-center gap-1"><Zap className="h-3 w-3" />+{xpReward} XP</span>
          </div>
          {(habit.intentionWhen || habit.intentionWhere) && (
            <p className="text-xs text-muted-foreground/50 italic mt-0.5 flex items-center gap-2 flex-wrap">
              {habit.intentionWhen && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{habit.intentionWhen}</span>
              )}
              {habit.intentionWhere && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{habit.intentionWhere}</span>
              )}
            </p>
          )}
          {habit.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{habit.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {completionsToday > 0 && !habit.archived && (
            <Button variant="ghost" size="sm" className="min-h-11 min-w-11 p-0 text-muted-foreground"
              onClick={() => undoComplete(habit)} disabled={!canWrite}>
              <Undo2 className="h-3 w-3" />
              <span className="sr-only">Undo {habit.name}</span>
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-h-11 min-w-11 p-0 text-muted-foreground">
                <MoreVertical className="h-3.5 w-3.5" />
                <span className="sr-only">More actions for {habit.name}</span>
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
        'group relative rounded-xl border bg-card/70 border-border p-3 transition-colors hover:border-primary/35 sm:p-5',
        isCompletedToday && 'opacity-50',
        isHighlighted && 'border-primary/50',
        habit.archived && 'opacity-40',
        habit.isKeystone && 'border-primary/40',
        offset > 0 && 'border-primary/60',
      )}
      style={swipeStyle}
      {...swipeHandlers}
    >
      {/* One compact header: identity + secondary actions */}
      <div className="mb-2 flex min-h-11 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-3 flex-wrap items-center gap-2">
            {habit.isKeystone && <span className="section-label flex items-center gap-1 text-primary"><Star className="h-3 w-3" />Keystone</span>}
            {habit.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
            {habit.difficulty && <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', habit.difficulty === 'hard' ? 'bg-destructive' : habit.difficulty === 'medium' ? 'bg-amber-500' : 'bg-muted-foreground')} />}
            {isTaskOverdue(habit, settings.system.timezone) && <span className="rounded-full bg-destructive/20 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-400">{t('overdue')}</span>}
          </div>
          <h3 className={cn('mt-1 truncate text-base font-bold leading-snug', isCompletedToday && 'line-through text-muted-foreground')} title={habit.name}>
            {habit.name}
          </h3>
        </div>

        {/* Actions dropdown — hidden until hover */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {completionsToday > 0 && !habit.archived && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11 p-0 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
              onClick={() => undoComplete(habit)}
              disabled={!canWrite}
            >
              <Undo2 className="h-3 w-3" />
              <span className="sr-only">Undo {habit.name}</span>
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className="grid min-h-11 min-w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                aria-label={`More actions for ${habit.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <HabitContextMenuItems habit={habit} onEditRequest={onEdit} onDeleteRequest={onDelete} context="habit-item" />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Compact schedule and reward row */}
      <div className="mb-3 flex min-w-0 items-center gap-2 text-xs">
        <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground" title={scheduleLabel}>{scheduleLabel}</span>
        <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-amber-400"><Coins className="h-3 w-3" />{habit.coinReward}</span>
        <span className="flex flex-shrink-0 items-center gap-1 font-semibold text-primary"><Zap className="h-3 w-3" />+{xpReward}</span>
      </div>

      {/* Compact evidence row */}
      <div className="mb-3 flex items-center justify-between gap-3 border-y border-border/70 py-2.5">
        <div>
          <p className={cn('text-sm font-semibold tabular-nums', isCompletedToday ? 'text-muted-foreground' : 'text-foreground')}>{streak}d streak</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{completionRate}% over 30 days</p>
        </div>

        <div className="flex items-center gap-1" aria-label="Seven day completion history">
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
                  'h-2 w-3.5 rounded-full transition-colors',
                  filled ? 'bg-primary' : 'bg-muted'
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
        aria-label={isCompletedToday ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        className={cn(
          'flex min-h-12 w-full touch-manipulation items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-colors',
          isCompletedToday
            ? 'bg-secondary text-muted-foreground hover:bg-muted'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        {isCompletedToday
          ? (<>Completed <Check className="h-3.5 w-3.5" /></>)
          : `Complete${target > 1 ? ` (${completionsToday}/${target})` : ''}`
        }
      </button>

      {/* Progressive details */}
      <div className="mt-1">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex min-h-11 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          {expanded ? 'Hide details' : 'Details'}
        </button>
        {expanded && (
          <div className="space-y-3 border-t border-border/70 pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Best streak <strong className="font-semibold text-foreground">{bestStreak}d</strong></span>
              <span>Schedule <strong className="font-semibold text-foreground">{scheduleLabel}</strong></span>
            </div>
            {(habit.intentionWhen || habit.intentionWhere) && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {habit.intentionWhen && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{habit.intentionWhen}</span>}
                {habit.intentionWhere && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{habit.intentionWhere}</span>}
              </p>
            )}
            {habit.description && <p className="text-sm leading-relaxed text-muted-foreground">{habit.description}</p>}
            {habit.drawing && <DrawingDisplay drawingData={habit.drawing} width={120} height={80} className="" />}
            {sharedAvatars && <div className="flex gap-1">{sharedAvatars}</div>}
            <HabitHeatmap habit={habit} timezone={settings.system.timezone} />
          </div>
        )}
      </div>
    </div>
  )
}
