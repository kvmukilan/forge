'use client'

import { Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, FolderOpen } from 'lucide-react'
import Link from 'next/link'

interface ProjectCardProps {
  project: Project
  total: number
  completed: number
  pct: number
  onEdit: () => void
  onDelete: () => void
}

export default function ProjectCard({ project, total, completed, pct, onEdit, onDelete }: ProjectCardProps) {
  const surfaceMap: Record<string, string> = {
    violet: 'border-slate-500/30 bg-slate-500/10',
    slate: 'border-slate-500/30 bg-slate-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    rose: 'border-rose-500/30 bg-rose-500/10',
    cyan: 'border-cyan-500/30 bg-cyan-500/10',
  }
  const barColorMap: Record<string, string> = {
    violet: 'bg-slate-400',
    slate: 'bg-slate-400',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    cyan: 'bg-cyan-500',
  }
  const surface = surfaceMap[project.color] ?? surfaceMap.emerald
  const barColor = barColorMap[project.color] ?? barColorMap.emerald

  return (
    <div className={cn('glass-card border p-4 flex flex-col gap-3', surface)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{project.emoji ?? '📁'}</span>
          <div>
            <h3 className="font-bold text-sm leading-tight">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completed}/{total} tasks done</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/20 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Link href={`/habits?project=${project.id}`} className="mt-auto">
        <Button size="sm" variant="secondary" className="w-full h-7 text-xs gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Open Tasks
        </Button>
      </Link>
    </div>
  )
}
