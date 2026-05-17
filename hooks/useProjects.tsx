'use client'

import { useAtom, useAtomValue } from 'jotai'
import { projectsAtom } from '@/lib/gamification-atoms'
import { habitsAtom, currentUserAtom } from '@/lib/atoms'
import { createProject, updateProject, deleteProject } from '@/app/actions/gamification'
import { Project } from '@/lib/types'

export function useProjects() {
  const [projectsData, setProjectsData] = useAtom(projectsAtom)
  const currentUser = useAtomValue(currentUserAtom)
  const [habitsData] = useAtom(habitsAtom)

  const projects = projectsData.projects.filter(p => !p.archived)

  const handleCreate = async (project: Omit<Project, 'id' | 'createdAt'>) => {
    const updated = await createProject({
      ...project,
      userIds: currentUser?.id ? [currentUser.id] : [],
    })
    setProjectsData(updated)
    return updated
  }

  const handleUpdate = async (project: Project) => {
    const updated = await updateProject(project)
    setProjectsData(updated)
    return updated
  }

  const handleDelete = async (id: string) => {
    const updated = await deleteProject(id)
    setProjectsData(updated)
    return updated
  }

  const getProjectTasks = (projectId: string) => {
    return habitsData.habits.filter(h => h.projectId === projectId && !h.archived)
  }

  const getProjectProgress = (projectId: string) => {
    const tasks = getProjectTasks(projectId)
    if (!tasks.length) return { total: 0, completed: 0, pct: 0 }
    const completed = tasks.filter(t => t.archived).length
    return { total: tasks.length, completed, pct: Math.round((completed / tasks.length) * 100) }
  }

  return { projects, createProject: handleCreate, updateProject: handleUpdate, deleteProject: handleDelete, getProjectTasks, getProjectProgress }
}
