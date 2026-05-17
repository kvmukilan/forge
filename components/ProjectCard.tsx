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
  const colorMap: Record<string, string> = {
    violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  }
  const barColorMap: Record<string, string> = {
    violet: 'from-violet-500 to-violet-400',
    blue: 'from-blue-500 to-blue-400',
    emerald: 'from-emerald-500 to-emerald-400',
    amber: 'from-amber-500 to-amber-400',
    rose: 'from-rose-500 to-rose-400',
    cyan: 'from-cyan-500 to-cyan-400',
  }
  const gradient = colorMap[project.color] ?? colorMap.violet
  const barColor = barColorMap[project.color] ?? barColorMap.violet

  return (
    <div className={cn('glass-card border bg-gradient-to-br p-4 flex flex-col gap-3', gradient)}>
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
            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barColor)}
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
