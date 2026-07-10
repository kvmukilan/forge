'use client'

import { useState } from 'react'
import { useAtom } from 'jotai'
import { completeWithNoteAtom } from '@/lib/atoms'
import { useHabits } from '@/hooks/useHabits'
import { setCompletionNote } from '@/app/actions/data'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Check } from 'lucide-react'

// Rendered once in ClientWrapper; opens when a context menu queues a habit
export default function CompleteWithNoteModal() {
  const [habit, setHabit] = useAtom(completeWithNoteAtom)
  const { completeHabit } = useHabits()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!habit) return null

  const close = () => {
    setHabit(null)
    setNote('')
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      const result = await completeHabit(habit)
      if (result?.newCompletionTimestamp && note.trim()) {
        await setCompletionNote(habit.id, result.newCompletionTimestamp, note.trim())
      }
      close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-sm font-bold">
          Complete “{habit.name}”
        </DialogTitle>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="How did it go? (optional note)"
          rows={3}
          autoFocus
          maxLength={500}
          className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        <button
          onClick={handleComplete}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {saving ? 'Logging…' : 'Complete'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
