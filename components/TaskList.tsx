'use client'

import { useState, useMemo } from 'react'
import { useAtom } from 'jotai'
import { habitsAtom } from '@/lib/atoms'
import { useHabits } from '@/hooks/useHabits'
import TaskCard from './TaskCard'
import TaskQuickAdd from './TaskQuickAdd'
import AddEditHabitModal from './AddEditHabitModal'
import ConfirmDialog from './ConfirmDialog'
import { Habit } from '@/lib/types'
import { Button } from './ui/button'
import { Plus } from 'lucide-react'

const PRIORITY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2 }

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  p1: { label: '🔴 P1 — Urgent', color: 'text-red-400' },
  p2: { label: '🟡 P2 — Normal', color: 'text-amber-400' },
  p3: { label: '🔵 P3 — Low', color: 'text-blue-400' },
  none: { label: 'No Priority', color: 'text-muted-foreground' },
}

export default function TaskList() {
  const [habitsData] = useAtom(habitsAtom)
  const { saveHabit, deleteHabit } = useHabits()
  const [editingTask, setEditingTask] = useState<Habit | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; habitId: string | null }>({ isOpen: false, habitId: null })

  const activeTasks = useMemo(() =>
    habitsData.habits
      .filter(h => h.isTask && !h.archived)
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? 'none'] ?? 3
        const pb = PRIORITY_ORDER[b.priority ?? 'none'] ?? 3
        if (pa !== pb) return pa - pb
        return new Date(a.frequency).getTime() - new Date(b.frequency).getTime()
      }),
    [habitsData.habits]
  )

  const archivedTasks = useMemo(() =>
    habitsData.habits.filter(h => h.isTask && h.archived),
    [habitsData.habits]
  )

  // Group active tasks by priority
  const grouped = useMemo(() => {
    const groups: { key: string; tasks: Habit[] }[] = []
    const seen = new Set<string>()
    for (const task of activeTasks) {
      const key = task.priority ?? 'none'
      if (!seen.has(key)) { seen.add(key); groups.push({ key, tasks: [] }) }
      groups.find(g => g.key === key)!.tasks.push(task)
    }
    return groups
  }, [activeTasks])

  const openModal = (task?: Habit) => {
    setEditingTask(task ?? null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTask(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="page-title">TASKS</h1>
          <p className="section-label mt-1">MISSION DIRECTORY · {activeTasks.length} REMAINING</p>
        </div>
        <Button onClick={() => openModal()} className="mt-2 bg-gradient-to-r from-orange-600 to-orange-500 border-0 text-white gap-2">
          <Plus className="h-4 w-4" /> NEW TASK
        </Button>
      </div>

      <TaskQuickAdd />

      {activeTasks.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <h3 className="font-semibold text-lg mb-1">No tasks yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Use the quick-add bar above or click New Task</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ key, tasks }) => {
            const isCritical = key === 'p1'
            const meta = PRIORITY_META[key] ?? PRIORITY_META.none

            if (isCritical) {
              return (
                <div key={key} className="critical-section mb-6">
                  <div className="critical-header flex items-center gap-2">
                    <span className="text-orange-400">⚠</span>
                    <span className="section-label text-orange-400">CRITICAL PAYLOAD</span>
                    <span className="ml-auto section-label text-orange-400">{tasks.length} REMAINING</span>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    {tasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => openModal(task)}
                        onDelete={() => setDeleteConfirm({ isOpen: true, habitId: task.id })}
                      />
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <div key={key} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="section-label">{meta.label}</span>
                  <span className="section-label opacity-50">· {tasks.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => openModal(task)}
                      onDelete={() => setDeleteConfirm({ isOpen: true, habitId: task.id })}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {archivedTasks.length > 0 && (
        <div>
          <div className="relative flex items-center my-4">
            <div className="flex-grow border-t border-white/10" />
            <span className="mx-4 text-xs text-muted-foreground">Archived</span>
            <div className="flex-grow border-t border-white/10" />
          </div>
          <div className="flex flex-col gap-2 opacity-60">
            {archivedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => openModal(task)}
                onDelete={() => setDeleteConfirm({ isOpen: true, habitId: task.id })}
              />
            ))}
          </div>
        </div>
      )}

      {isModalOpen && (
        <AddEditHabitModal
          isTask={true}
          habit={editingTask}
          onClose={closeModal}
          onSave={async (habit) => {
            await saveHabit({ ...habit, id: editingTask?.id, isTask: true })
            closeModal()
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, habitId: null })}
        onConfirm={async () => {
          if (deleteConfirm.habitId) await deleteHabit(deleteConfirm.habitId)
          setDeleteConfirm({ isOpen: false, habitId: null })
        }}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmText="Delete"
      />
    </div>
  )
}
