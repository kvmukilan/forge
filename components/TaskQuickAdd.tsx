'use client'

import { useState } from 'react'
import { useHabits } from '@/hooks/useHabits'
import { useAtom } from 'jotai'
import { settingsAtom, currentUserAtom } from '@/lib/atoms'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Plus } from 'lucide-react'
import { hasPermission, getNow, d2t } from '@/lib/utils'

export default function TaskQuickAdd() {
  const [value, setValue] = useState('')
  const { saveHabit } = useHabits()
  const [settings] = useAtom(settingsAtom)
  const [currentUser] = useAtom(currentUserAtom)
  const canWrite = hasPermission(currentUser, 'habit', 'write')

  const handleAdd = async () => {
    const name = value.trim()
    if (!name || !canWrite) return
    const today = getNow({ timezone: settings.system.timezone })
    await saveHabit({
      name,
      description: '',
      frequency: d2t({ dateTime: today }),
      coinReward: 5,
      completions: [],
      isTask: true,
      userIds: currentUser ? [currentUser.id] : [],
    })
    setValue('')
  }

  return (
    <div className="flex gap-2 mb-4">
      <Input
        placeholder="Quick add a task... (Enter to add)"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        disabled={!canWrite}
        className="flex-1"
      />
      <Button onClick={handleAdd} disabled={!canWrite || !value.trim()} size="sm" className="gap-1">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
