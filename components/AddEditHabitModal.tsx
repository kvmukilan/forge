'use client'

import { useState } from 'react'
import { RRule } from 'rrule'
import { useAtom } from 'jotai'
import { useTranslations } from 'next-intl'
import { settingsAtom, usersAtom, currentUserAtom } from '@/lib/atoms'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Brush } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Habit, HabitCategory } from '@/lib/types'
import { projectsAtom } from '@/lib/gamification-atoms'
import EmojiPickerButton from './EmojiPickerButton'
import ModalOverlay from './ModalOverlay' // Import the new component
import DrawingModal from './DrawingModal'
import DrawingDisplay from './DrawingDisplay'
import { convertHumanReadableFrequencyToMachineReadable, convertMachineReadableFrequencyToHumanReadable, d2t, serializeRRule } from '@/lib/utils'
import { INITIAL_DUE, INITIAL_RECURRENCE_RULE, QUICK_DATES, MAX_COIN_LIMIT } from '@/lib/constants'
import { DateTime } from 'luxon'
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  getAttributeRewardForDifficulty,
  getPrimaryAttributeForCategory,
  type AttributeKey,
} from '@/lib/progression'


interface AddEditHabitModalProps {
  onClose: () => void
  onSave: (habit: Omit<Habit, 'id'>) => Promise<void>
  habit?: Habit | null
  isTask: boolean
}

export default function AddEditHabitModal({ onClose, onSave, habit, isTask }: AddEditHabitModalProps) {
  const t = useTranslations('AddEditHabitModal');
  const [settings] = useAtom(settingsAtom)
  const [name, setName] = useState(habit?.name || '')
  const [description, setDescription] = useState(habit?.description || '')
  const [coinReward, setCoinReward] = useState(habit?.coinReward || 1)
  const [targetCompletions, setTargetCompletions] = useState(habit?.targetCompletions || 1)
  const isRecurRule = !isTask
  // Initialize ruleText with the actual frequency string or default, not the display text
  const initialRuleText = habit?.frequency ? convertMachineReadableFrequencyToHumanReadable({
    frequency: habit.frequency,
    isRecurRule,
    timezone: settings.system.timezone
  }) : (isRecurRule ? INITIAL_RECURRENCE_RULE : INITIAL_DUE);
  const [ruleText, setRuleText] = useState<string>(initialRuleText)
  const [currentUser] = useAtom(currentUserAtom)
  const [isQuickDatesOpen, setIsQuickDatesOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // State for validation message
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>((habit?.userIds || []).filter(id => id !== currentUser?.id))
  const [usersData] = useAtom(usersAtom)
  const users = usersData.users
  const [drawing, setDrawing] = useState<string>(habit?.drawing || '')
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false)
  const [priority, setPriority] = useState<'p1' | 'p2' | 'p3' | undefined>(habit?.priority)
  const [intentionWhen, setIntentionWhen] = useState(habit?.intentionWhen || '')
  const [intentionWhere, setIntentionWhere] = useState(habit?.intentionWhere || '')
  const [isKeystone, setIsKeystone] = useState(habit?.isKeystone || false)
  const [projectId, setProjectId] = useState<string | undefined>(habit?.projectId)
  const [category, setCategory] = useState<HabitCategory | undefined>(habit?.category)
  const [difficulty, setDifficulty] = useState<Habit['difficulty']>(habit?.difficulty ?? 'medium')
  const [primaryAttribute, setPrimaryAttribute] = useState<AttributeKey>(
    habit?.primaryAttribute ?? getPrimaryAttributeForCategory(habit?.category ?? null),
  )
  const [secondaryAttribute, setSecondaryAttribute] = useState<AttributeKey | ''>(habit?.secondaryAttribute ?? '')
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(habit?.adaptiveEnabled ?? true)
  const [pausedUntil, setPausedUntil] = useState(habit?.pausedUntil ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState(habit?.estimatedMinutes ?? 10)
  const [projectsData] = useAtom(projectsAtom)

  function getFrequencyUpdate() {
    if (ruleText === initialRuleText && habit?.frequency) {
      // If text hasn't changed and original frequency exists, return it
      return habit.frequency;
    }

    const parsedResult = convertHumanReadableFrequencyToMachineReadable({
      text: ruleText,
      timezone: settings.system.timezone,
      isRecurring: isRecurRule
    });

    if (parsedResult.result) {
      return isRecurRule
        ? serializeRRule(parsedResult.result as RRule)
        : d2t({
          dateTime: parsedResult.result as DateTime,
          timezone: settings.system.timezone
        });
    } else {
      return 'invalid';
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name,
      description,
      coinReward,
      targetCompletions: targetCompletions > 1 ? targetCompletions : undefined,
      completions: habit?.completions || [],
      frequency: getFrequencyUpdate(),
      userIds: selectedUserIds.length > 0 ? selectedUserIds.concat(currentUser?.id || []) : (currentUser && [currentUser.id]),
      drawing: drawing && drawing !== '[]' ? drawing : undefined,
      priority: isTask ? priority : undefined,
      projectId: isTask ? projectId : undefined,
      intentionWhen: !isTask && intentionWhen ? intentionWhen : undefined,
      intentionWhere: !isTask && intentionWhere ? intentionWhere : undefined,
      isKeystone: !isTask ? isKeystone : undefined,
      category: !isTask ? category : undefined,
      difficulty: !isTask ? difficulty : habit?.difficulty,
      primaryAttribute: !isTask ? primaryAttribute : habit?.primaryAttribute,
      secondaryAttribute: !isTask ? secondaryAttribute || undefined : habit?.secondaryAttribute,
      attributeReward: !isTask ? getAttributeRewardForDifficulty(difficulty) : habit?.attributeReward,
      progressionOrigin: habit?.progressionOrigin ?? 'custom',
      adaptiveEnabled: !isTask ? adaptiveEnabled : habit?.adaptiveEnabled,
      adaptationLevel: habit?.adaptationLevel ?? 0,
      lastAdaptedAt: habit?.lastAdaptedAt,
      pausedUntil: !isTask && pausedUntil ? pausedUntil : undefined,
      estimatedMinutes: !isTask ? estimatedMinutes : habit?.estimatedMinutes,
      recommendationReason: habit?.recommendationReason,
    })
  }

  return (
    <>
      <ModalOverlay />
      <Dialog open={true} onOpenChange={(open) => {
        if (!open && !isDrawingModalOpen) {
          onClose()
        }
      }} modal={false}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl p-4 sm:max-w-2xl sm:p-6 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11 [&_select]:min-h-11"> {/* DialogContent from shadcn/ui is typically z-50, ModalOverlay is z-40 */}
          <DialogHeader>
            <DialogTitle>
              {habit
                ? t(isTask ? 'editTaskTitle' : 'editHabitTitle')
                : t(isTask ? 'addNewTaskTitle' : 'addNewHabitTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="name" className="text-left sm:text-right">
                  {t('nameLabel')}
                </Label>
                <div className='flex gap-2 sm:col-span-3'>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <EmojiPickerButton
                    inputIdToFocus="name"
                    onEmojiSelect={(emoji) => {
                      setName(prev => {
                        const space = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
                        return `${prev}${space}${emoji}`;
                      })
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="description" className="text-left sm:text-right">
                  {t('descriptionLabel')}
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="sm:col-span-3"
                />
              </div>
              {isTask && (
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label className="text-left text-sm sm:text-right">Priority</Label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    {(['p1', 'p2', 'p3'] as const).map(p => {
                      const labels = { p1: 'Urgent', p2: 'Normal', p3: 'Low' }
                      const active = priority === p
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(prev => prev === p ? undefined : p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? p === 'p1' ? 'bg-primary text-primary-foreground border-primary'
                                : p === 'p2' ? 'bg-primary/30 text-foreground border-primary/40'
                                : 'bg-muted text-foreground border-border'
                              : 'border-muted-foreground text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {labels[p]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {isTask && (
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label className="text-left text-sm sm:text-right">Project</Label>
                  <div className="sm:col-span-3">
                    <select
                      value={projectId ?? ''}
                      onChange={e => setProjectId(e.target.value || undefined)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value=''>No project</option>
                      {projectsData.projects.filter(p => !p.archived).length === 0
                        ? <option disabled value=''>— Create a project first —</option>
                        : projectsData.projects.filter(p => !p.archived).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.emoji ? `${p.emoji} ${p.name}` : p.name}
                            </option>
                          ))
                      }
                    </select>
                  </div>
                </div>
              )}
              {!isTask && (
                <>
                  <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                    <Label className="text-left text-sm sm:text-right">When?</Label>
                    <Input
                      className="sm:col-span-3"
                      placeholder='e.g. "7:00 AM"'
                      value={intentionWhen}
                      onChange={e => setIntentionWhen(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                    <Label className="text-left text-sm sm:text-right">Where?</Label>
                    <Input
                      className="sm:col-span-3"
                      placeholder='e.g. "Kitchen table"'
                      value={intentionWhere}
                      onChange={e => setIntentionWhere(e.target.value)}
                    />
                  </div>
                </>
              )}
              {!isTask && (
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label className="text-left text-sm sm:text-right">Keystone</Label>
                  <div className="flex items-center gap-3 sm:col-span-3">
                    <Switch checked={isKeystone} onCheckedChange={setIsKeystone} />
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3 text-primary flex-shrink-0" /> Completing this first gives +25% XP for the day</span>
                  </div>
                </div>
              )}
              {!isTask && (
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:gap-4">
                  <Label className="text-left text-sm sm:pt-2 sm:text-right">Progression</Label>
                  <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Difficulty
                      <select value={difficulty} onChange={event => setDifficulty(event.target.value as Habit['difficulty'])} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:text-sm">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Estimated minutes
                      <Input type="number" min={1} max={240} value={estimatedMinutes} onChange={event => setEstimatedMinutes(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Primary attribute
                      <select value={primaryAttribute} onChange={event => setPrimaryAttribute(event.target.value as AttributeKey)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:text-sm">
                        {ATTRIBUTE_KEYS.map(key => <option key={key} value={key}>{ATTRIBUTE_LABELS[key]}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Secondary attribute
                      <select value={secondaryAttribute} onChange={event => setSecondaryAttribute(event.target.value as AttributeKey | '')} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground sm:text-sm">
                        <option value="">None</option>
                        {ATTRIBUTE_KEYS.filter(key => key !== primaryAttribute).map(key => <option key={key} value={key}>{ATTRIBUTE_LABELS[key]}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                      Pause through
                      <Input type="date" value={pausedUntil} onChange={event => setPausedUntil(event.target.value)} />
                    </label>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                      <span className="text-xs font-semibold text-muted-foreground">Adaptive suggestions</span>
                      <Switch aria-label="Adaptive suggestions" checked={adaptiveEnabled} onCheckedChange={setAdaptiveEnabled} />
                    </div>
                  </div>
                </div>
              )}
              {!isTask && (
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label className="text-left text-sm sm:text-right">Category</Label>
                  <div className="sm:col-span-3">
                    <Select value={category ?? 'none'} onValueChange={(value) => setCategory(value === 'none' ? undefined : value as HabitCategory)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        <SelectItem value="fitness">Fitness</SelectItem>
                        <SelectItem value="learning">Learning</SelectItem>
                        <SelectItem value="mindfulness">Mindfulness</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                        <SelectItem value="productivity">Productivity</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="recurrence" className="text-left sm:text-right">
                  {t('whenLabel')}
                </Label>
                {/* date input (task) */}
                <div className="space-y-2 sm:col-span-3">
                  <div className="flex gap-2">
                    <Input
                      id="recurrence"
                      value={ruleText}
                      onChange={(e) => setRuleText(e.target.value)}
                      required
                    />
                    {isTask && (
                      <Popover open={isQuickDatesOpen} onOpenChange={setIsQuickDatesOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-11 min-w-11"
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-3 w-[280px] max-h-[40vh] overflow-y-auto" align="start">
                          <div className="space-y-1">
                            <div className="grid grid-cols-2 gap-2">
                              {QUICK_DATES.map((date) => (
                                <Button
                                  key={date.value}
                                  variant="outline"
                                  className="min-h-11 justify-start px-3 hover:bg-primary hover:text-primary-foreground transition-colors"
                                  onClick={() => {
                                    setRuleText(date.value);
                                    setIsQuickDatesOpen(false);
                                  }}
                                >
                                  {date.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
                {/* rrule input (habit) */}
                <div className="text-sm sm:col-start-2 sm:col-span-3">
                  {(() => {
                    let displayText = '';
                    const { result, message } = convertHumanReadableFrequencyToMachineReadable({ text: ruleText, timezone: settings.system.timezone, isRecurring: isRecurRule });
                    if (message !== errorMessage) { // Only update if it changed to avoid re-renders
                      setErrorMessage(message);
                    }
                    displayText = convertMachineReadableFrequencyToHumanReadable({ frequency: result, isRecurRule, timezone: settings.system.timezone })

                    return (
                      <>
                        <span className={errorMessage ? 'text-destructive' : 'text-muted-foreground'}>
                          {displayText}
                        </span>
                        {errorMessage && (
                          <p className="text-destructive text-xs mt-1">{errorMessage}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Label htmlFor="targetCompletions">
                    {t('completeLabel')}
                  </Label>
                </div>
                <div className="sm:col-span-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setTargetCompletions(prev => Math.max(1, prev - 1))}
                        className="min-h-11 min-w-11 px-3 py-2 bg-secondary hover:bg-muted transition-colors"
                        aria-label="Decrease completions"
                      >
                        -
                      </button>
                      <Input
                        id="targetCompletions"
                        type="number"
                        value={targetCompletions}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          setTargetCompletions(isNaN(value) ? 1 : Math.max(1, value))
                        }}
                        min={1}
                        max={10}
                        className="w-20 text-center border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setTargetCompletions(prev => Math.min(10, prev + 1))}
                        className="min-h-11 min-w-11 px-3 py-2 bg-secondary hover:bg-muted transition-colors"
                        aria-label="Increase completions"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('timesSuffix')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Label htmlFor="coinReward">
                    {t('rewardLabel')}
                  </Label>
                </div>
                <div className="sm:col-span-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCoinReward(prev => Math.max(0, prev - 1))}
                        className="min-h-11 min-w-11 px-3 py-2 bg-secondary hover:bg-muted transition-colors"
                        aria-label="Decrease coin reward"
                      >
                        -
                      </button>
                      <Input
                        id="coinReward"
                        type="number"
                        value={coinReward}
                        onChange={(e) => {
                          const value = parseInt(e.target.value === "" ? "0" : e.target.value)
                          setCoinReward(Math.min(value, MAX_COIN_LIMIT))
                        }}
                        min={0}
                        max={MAX_COIN_LIMIT}
                        required
                        className="w-20 text-center border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCoinReward(prev => Math.min(prev + 1, MAX_COIN_LIMIT))}
                        className="min-h-11 min-w-11 px-3 py-2 bg-secondary hover:bg-muted transition-colors"
                        aria-label="Increase coin reward"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t('coinsSuffix')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label className="text-left sm:text-right">
                  {t('drawingLabel')}
                </Label>
                <div className="sm:col-span-3">
                  <div className="flex gap-4 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsDrawingModalOpen(true)
                      }}
                      className="flex-1 justify-start"
                    >
                      <Brush className="h-4 w-4 mr-2" />
                      {drawing ? t('editDrawing') : t('addDrawing')}
                    </Button>
                    {drawing && (
                      <div className="flex-shrink-0">
                        <DrawingDisplay
                          drawingData={drawing}
                          width={80}
                          height={53}
                          className=""
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {users && users.length > 1 && (
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Label htmlFor="sharing-toggle">{t('shareLabel')}</Label>
                  </div>
                  <div className="sm:col-span-3">
                    <div className="flex flex-wrap gap-2">
                      {users.filter((u) => u.id !== currentUser?.id).map(user => (
                        <Avatar
                          key={user.id}
                          className={`h-8 w-8 border-2 cursor-pointer
                          ${selectedUserIds.includes(user.id)
                              ? 'border-primary'
                              : 'border-muted'
                            }`}
                          title={user.username}
                          onClick={() => {
                            setSelectedUserIds(prev =>
                              prev.includes(user.id)
                                ? prev.filter(id => id !== user.id)
                                : [...prev, user.id]
                            )
                          }}
                        >
                          <AvatarImage src={user?.avatarPath && `/api/avatars/${user.avatarPath.split('/').pop()}` || ""} />
                          <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="min-h-11 w-full rounded-xl sm:w-auto" disabled={!!errorMessage}>
                {habit
                  ? t('saveChangesButton')
                  : t(isTask ? 'addTaskButton' : 'addHabitButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DrawingModal
        isOpen={isDrawingModalOpen}
        onClose={() => setIsDrawingModalOpen(false)}
        onSave={(drawingData) => setDrawing(drawingData)}
        initialDrawing={drawing}
        title={name}
      />
    </>
  )
}

