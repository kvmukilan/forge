'use client'

import { useState } from 'react'
import { useProjects } from '@/hooks/useProjects'
import ProjectCard from '@/components/ProjectCard'
import AddEditProjectModal from '@/components/AddEditProjectModal'
import { Button } from '@/components/ui/button'
import { Plus, FolderKanban } from 'lucide-react'
import { Project } from '@/lib/types'

export default function ProjectsPage() {
  const { projects, createProject, updateProject, deleteProject, getProjectProgress } = useProjects()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>()

  const handleSave = async (data: Omit<Project, 'id' | 'createdAt'>) => {
    if (editingProject) {
      await updateProject({ ...editingProject, ...data })
    } else {
      await createProject(data)
    }
    setEditingProject(undefined)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteProject(id)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize your tasks into projects</p>
        </div>
        <Button
          onClick={() => { setEditingProject(undefined); setModalOpen(true) }}
          className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-semibold text-lg mb-1">No projects yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Create a project to organize your tasks and track progress</p>
          <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => {
            const { total, completed, pct } = getProjectProgress(project.id)
            return (
              <ProjectCard
                key={project.id}
                project={project}
                total={total}
                completed={completed}
                pct={pct}
                onEdit={() => handleEdit(project)}
                onDelete={() => handleDelete(project.id)}
              />
            )
          })}
        </div>
      )}

      <AddEditProjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        project={editingProject}
        onSave={handleSave}
      />
    </div>
  )
}
