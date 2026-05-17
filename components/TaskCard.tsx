'use client'

import { Habit } from '@/lib/types'
import { useHabits } from '@/hooks/useHabits'
import { useAtom } from 'jotai'
import { settingsAtom, currentUserAtom } from '@/lib/atoms'
import { getCompletionsForToday, isTaskOverdue, convertMachineReadableFrequencyToHumanReadable, hasPermission } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Check, Flame, Edit, MoreVertical, Coins, Zap, Undo2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'
import { HabitContextMenuItems } from './HabitContextMenuItems'
import { calculateHabitXP } from '@/lib/gamification'

const PRIORITY_BORDER: Record<string, string> = {
  p1: 'border-l-red-500',
  p2: 'border-l-amber-400',
  p3: 'border-l-blue-400',
  none: 'border-l-border',
}

const PRIORITY_LABEL: Record<string, string> = {
  p1: '🔴 P1',
  p2: '🟡 P2',
  p3: '🔵 P3',
}

interface TaskCardProps {
  task: Habit
  onEdit: () => void
  onDelete: () => void
}

export default function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { completeHabit, undoComplete } = useHabits()
  const [settings] = useAtom(settingsAtom)
  const [currentUser] = useAtom(currentUserAtom)
  const timezone = settings.system.timezone
  const canInteract = hasPermission(currentUser, 'habit', 'interact')
  const canWrite = hasPermission(currentUser, 'habit', 'write')

  const completionsToday = getCompletionsForToday({ habit: task, timezone })
  const target = task.targetCompletions || 1
  const isCompleted = completionsToday >= target
  const overdue = isTaskOverdue(task, timezone)
  const xpReward = calculateHabitXP(task)

  const dueDateDisplay = convertMachineReadableFrequencyToHumanReadable({
    frequency: task.frequency,
    isRecurRule: false,
    timezone,
  })

  const priorityKey = task.priority ?? 'none'
  const borderClass = PRIORITY_BORDER[priorityKey] ?? PRIORITY_BORDER.none

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg bg-card border border-l-4 transition-all',
      borderClass,
      overdue && !isCompleted && 'border-red-500/40',
      isCompleted && 'opacity-60',
    )}>
      {/* Checkbox */}
      <button
        onClick={() => isCompleted ? undoComplete(task) : completeHabit(task)}
        disabled={!canInteract || task.archived}
        className={cn(
          'mt-0.5 h-5 w-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : overdue
              ? 'border-red-400 hover:border-red-300'
              : 'border-muted-foreground hover:border-primary'
        )}
      >
        {isCompleted && <Check className="h-3 w-3" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {overdue && !isCompleted && <Flame className="h-3.5 w-3.5 text-red-500 animate-pulse flex-shrink-0" />}
          {task.priority && (
            <span className="text-xs font-medium text-muted-foreground">{PRIORITY_LABEL[task.priority]}</span>
          )}
          <span className={cn('font-medium text-sm', isCompleted && 'line-through text-muted-foreground')}>
            {task.name}
          </span>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.frequency ? (() => {
            const now = DateTime.now().setZone(timezone)
            const due = DateTime.fromISO(task.frequency).setZone(timezone)
            if (due.isValid) {
              const diff = due.diff(now, ['days', 'hours']).toObject()
              const daysLeft = Math.floor(diff.days ?? 0)
              const hoursLeft = Math.floor(diff.hours ?? 0)
              if (overdue && !isCompleted) {
                const daysOverdue = Math.abs(daysLeft)
                return <span className="text-xs font-bold text-red-400 uppercase tracking-wide">T+{daysOverdue}D OVERDUE</span>
              } else if (daysLeft === 0) {
                return <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">DUE TODAY · {hoursLeft}H</span>
              } else {
                return <span className="section-label">due {dueDateDisplay}</span>
              }
            }
            return <span className="section-label">{dueDateDisplay}</span>
          })() : (
            <span className="section-label">{dueDateDisplay}</span>
          )}
          <span className="text-xs text-amber-400 flex items-center gap-0.5">
            <Coins className="h-3 w-3" /> {task.coinReward}
          </span>
          <span className="text-xs text-violet-400 flex items-center gap-0.5">
            <Zap className="h-3 w-3" /> +{xpReward} XP
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {completionsToday > 0 && !task.archived && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => undoComplete(task)} disabled={!canWrite}>
            <Undo2 className="h-3 w-3" />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden sm:flex"
          onClick={onEdit} disabled={!canWrite}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <HabitContextMenuItems habit={task} onEditRequest={onEdit} onDeleteRequest={onDelete} context="habit-item" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
