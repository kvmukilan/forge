'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function RecheckButton() {
  const handleRecheck = () => {
    window.location.reload()
  }

  return (
    <Button 
      onClick={handleRecheck}
      variant="outline" 
      size="sm"
      className="rounded-lg bg-destructive/10 border-destructive/40 text-red-400 hover:bg-destructive/20 hover:text-red-400"
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Recheck
    </Button>
  )
}