'use client'

import { useState, useMemo, useEffect } from 'react' // Added useMemo, useEffect
import { Plus, ArrowUpNarrowWide, ArrowDownWideNarrow, Search } from 'lucide-react' // Added sort icons, Search icon
import { useAtom } from 'jotai'
import { useTranslations } from 'next-intl'
import { habitsAtom, browserSettingsAtom } from '@/lib/atoms'
import EmptyState from './EmptyState'
import { Button } from '@/components/ui/button'
import HabitItem from './HabitItem'
import AddEditHabitModal from './AddEditHabitModal'
import ConfirmDialog from './ConfirmDialog'
import { Habit } from '@/lib/types'
import { useHabits } from '@/hooks/useHabits'
import { HabitIcon, TaskIcon } from '@/lib/constants'
import { ViewToggle } from './ViewToggle'
import { Input } from '@/components/ui/input' // Added
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select' // Added
import { Label } from '@/components/ui/label' // Added
import { DateTime } from 'luxon' // Added
import { getHabitFreq } from '@/lib/utils' // Added

export default function HabitList({ viewOverride }: { viewOverride?: 'habits' | 'tasks' }) {
  const t = useTranslations('HabitList');
  const { saveHabit, deleteHabit } = useHabits()
  const [habitsData] = useAtom(habitsAtom) // setHabitsData removed as it's not used
  const [browserSettings] = useAtom(browserSettingsAtom)
  const isTasksView = viewOverride ? viewOverride === 'tasks' : browserSettings.viewType === 'tasks'
  // const [settings] = useAtom(settingsAtom); // settingsAtom is not directly used in HabitList itself.

  type SortableField = 'name' | 'coinReward' | 'dueDate' | 'frequency';
  type SortOrder = 'asc' | 'desc';

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortableField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    if (isTasksView && sortBy === 'frequency') {
      setSortBy('name');
    } else if (!isTasksView && sortBy === 'dueDate') {
      setSortBy('name');
    }
  }, [isTasksView, sortBy]);

  const compareHabits = useMemo(() => {
    return (a: Habit, b: Habit, currentSortBy: SortableField, currentSortOrder: SortOrder, tasksView: boolean): number => {
      let comparison = 0;
      switch (currentSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'coinReward':
          comparison = a.coinReward - b.coinReward;
          break;
        case 'dueDate':
          if (tasksView && a.isTask && b.isTask) {
            const dateA = DateTime.fromISO(a.frequency);
            const dateB = DateTime.fromISO(b.frequency);
            if (dateA.isValid && dateB.isValid) comparison = dateA.toMillis() - dateB.toMillis();
            else if (dateA.isValid) comparison = -1; // Valid dates first
            else if (dateB.isValid) comparison = 1;
            // If both invalid, comparison remains 0
          }
          break;
        case 'frequency':
          if (!tasksView && !a.isTask && !b.isTask) {
            const freqOrder = ['daily', 'weekly', 'monthly', 'yearly'];
            const freqAVal = getHabitFreq(a);
            const freqBVal = getHabitFreq(b);
            comparison = freqOrder.indexOf(freqAVal) - freqOrder.indexOf(freqBVal);
          }
          break;
      }
      return currentSortOrder === 'asc' ? comparison : -comparison;
    };
  }, []);

  const allHabitsInView = useMemo(() => {
    return habitsData.habits.filter(habit =>
      isTasksView ? habit.isTask : !habit.isTask
    );
  }, [habitsData.habits, isTasksView]);

  const searchedHabits = useMemo(() => {
    if (!searchTerm.trim()) {
      return allHabitsInView;
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return allHabitsInView.filter(habit =>
      habit.name.toLowerCase().includes(lowercasedSearchTerm) ||
      (habit.description && habit.description.toLowerCase().includes(lowercasedSearchTerm))
    );
  }, [allHabitsInView, searchTerm]);

  const activeHabits = useMemo(() => {
    return searchedHabits
      .filter(h => !h.archived)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // For items in the same pinned group (both pinned or both not pinned), apply general sort
        return compareHabits(a, b, sortBy, sortOrder, isTasksView);
      });
  }, [searchedHabits, sortBy, sortOrder, isTasksView, compareHabits]);

  const archivedHabits = useMemo(() => {
    return searchedHabits
      .filter(h => h.archived)
      .sort((a, b) => compareHabits(a, b, sortBy, sortOrder, isTasksView));
  }, [searchedHabits, sortBy, sortOrder, isTasksView, compareHabits]);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean,
    isTask: boolean
  }>({
    isOpen: false,
    isTask: false
  })
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, habitId: string | null }>({
    isOpen: false,
    habitId: null
  })


  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="page-title">{isTasksView ? 'TASKS' : 'THE VAULT'}</h1>
          <p className="section-label mt-1">
            {isTasksView ? 'MISSION DIRECTORY' : 'HABIT DIRECTORY'} · {activeHabits.length} ACTIVE
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          {!viewOverride && (
            <Button variant="outline" size="sm" onClick={() => setModalConfig({ isOpen: true, isTask: true })}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> {t('addTaskButton')}
            </Button>
          )}
          <Button size="sm" onClick={() => setModalConfig({ isOpen: true, isTask: false })}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> {t('addHabitButton')}
          </Button>
        </div>
      </div>
      {!viewOverride && (
        <div className='py-4'>
          <ViewToggle />
        </div>
      )}

      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 my-4">
        <div className="relative flex-grow w-full sm:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input
            type="search"
            placeholder={t(isTasksView ? 'searchTasksPlaceholder' : 'searchHabitsPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center w-full sm:w-auto">
          <Label htmlFor="sort-by" className="text-sm font-medium whitespace-nowrap sr-only sm:not-sr-only">{t('sortByLabel')}</Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortableField)}>
            <SelectTrigger id="sort-by" className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('sortByLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t('sortByName')}</SelectItem>
              <SelectItem value="coinReward">{t('sortByCoinReward')}</SelectItem>
              {isTasksView && <SelectItem value="dueDate">{t('sortByDueDate')}</SelectItem>}
              {!isTasksView && <SelectItem value="frequency">{t('sortByFrequency')}</SelectItem>}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
            {sortOrder === 'asc' ? <ArrowUpNarrowWide className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
            <span className="sr-only">{t('toggleSortOrderAriaLabel')}</span>
          </Button>
        </div>
      </div>

      {isTasksView ? (
        /* Tasks — column layout */
        <div className="flex flex-col gap-2">
          {activeHabits.length === 0 && searchTerm.trim() ? (
            <div className="text-center text-muted-foreground py-8">
              {t('noTasksFoundMessage')}
            </div>
          ) : activeHabits.length === 0 ? (
            <EmptyState
              icon={TaskIcon}
              title={t('emptyStateTasksTitle')}
              description={t('emptyStateTasksDescription')}
            />
          ) : (
            activeHabits.map((habit: Habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                onEdit={() => {
                  setEditingHabit(habit)
                  setModalConfig({ isOpen: true, isTask: true })
                }}
                onDelete={() => setDeleteConfirmation({ isOpen: true, habitId: habit.id })}
              />
            ))
          )}
          {archivedHabits.length > 0 && (
            <>
              <div className="relative flex items-center my-6">
                <div className="flex-grow border-t border-border/60" />
                <span className="mx-4 section-title">{t('archivedSectionTitle')}</span>
                <div className="flex-grow border-t border-border/60" />
              </div>
              {archivedHabits.map((habit: Habit) => (
                <HabitItem
                  key={habit.id}
                  habit={habit}
                  onEdit={() => {
                    setEditingHabit(habit)
                    setModalConfig({ isOpen: true, isTask: true })
                  }}
                  onDelete={() => setDeleteConfirmation({ isOpen: true, habitId: habit.id })}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        /* Habits — grid layout */
        <>
          {activeHabits.length === 0 && searchTerm.trim() ? (
            <div className="text-center text-muted-foreground py-8">
              {t('noHabitsFoundMessage')}
            </div>
          ) : activeHabits.length === 0 ? (
            <EmptyState
              icon={HabitIcon}
              title={t('emptyStateHabitsTitle')}
              description={t('emptyStateHabitsDescription')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeHabits.map((habit: Habit) => (
                <HabitItem
                  key={habit.id}
                  habit={habit}
                  onEdit={() => {
                    setEditingHabit(habit)
                    setModalConfig({ isOpen: true, isTask: false })
                  }}
                  onDelete={() => setDeleteConfirmation({ isOpen: true, habitId: habit.id })}
                />
              ))}
            </div>
          )}
          {archivedHabits.length > 0 && (
            <>
              <div className="relative flex items-center my-6">
                <div className="flex-grow border-t border-border/60" />
                <span className="mx-4 section-title">{t('archivedSectionTitle')}</span>
                <div className="flex-grow border-t border-border/60" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedHabits.map((habit: Habit) => (
                  <HabitItem
                    key={habit.id}
                    habit={habit}
                    onEdit={() => {
                      setEditingHabit(habit)
                      setModalConfig({ isOpen: true, isTask: false })
                    }}
                    onDelete={() => setDeleteConfirmation({ isOpen: true, habitId: habit.id })}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {modalConfig.isOpen &&
        <AddEditHabitModal
          onClose={() => {
            setModalConfig({ isOpen: false, isTask: false })
            setEditingHabit(null)
          }}
          onSave={async (habit) => {
            await saveHabit({ ...habit, id: editingHabit?.id, isTask: modalConfig.isTask })
            setModalConfig({ isOpen: false, isTask: false })
            setEditingHabit(null)
          }}
          habit={editingHabit}
          isTask={modalConfig.isTask}
        />
      }
      <ConfirmDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, habitId: null })}
        onConfirm={async () => {
          if (deleteConfirmation.habitId) {
            await deleteHabit(deleteConfirmation.habitId)
          }
          setDeleteConfirmation({ isOpen: false, habitId: null })
        }}
        title={t(isTasksView ? 'deleteTaskDialogTitle' : 'deleteHabitDialogTitle')}
        message={t(isTasksView ? 'deleteTaskDialogMessage' : 'deleteHabitDialogMessage')}
        confirmText={t('deleteButton')}
      />
    </div>
  )
}

