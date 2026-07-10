'use client'

import { useRef, useState, type PointerEvent } from 'react'

const TRIGGER_PX = 72
const MAX_DRAG_PX = 110

interface SwipeOptions {
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  disabled?: boolean
}

// Touch-only horizontal swipe for list items: right = complete, left = undo.
// Returns pointer handlers plus the live x-offset for visual feedback.
export function useSwipeComplete({ onSwipeRight, onSwipeLeft, disabled }: SwipeOptions) {
  const [offset, setOffset] = useState(0)
  const startX = useRef<number | null>(null)
  const startY = useRef(0)
  const axisLocked = useRef<'x' | 'y' | null>(null)

  const reset = () => {
    startX.current = null
    axisLocked.current = null
    setOffset(0)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (disabled || e.pointerType === 'mouse') return
    startX.current = e.clientX
    startY.current = e.clientY
    axisLocked.current = null
  }

  const onPointerMove = (e: PointerEvent) => {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (axisLocked.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axisLocked.current !== 'x') return

    const canRight = !!onSwipeRight
    const canLeft = !!onSwipeLeft
    const clamped = Math.max(canLeft ? -MAX_DRAG_PX : 0, Math.min(canRight ? MAX_DRAG_PX : 0, dx))
    setOffset(clamped)
  }

  const onPointerUp = () => {
    if (startX.current === null) return
    if (offset >= TRIGGER_PX && onSwipeRight) {
      onSwipeRight()
    } else if (offset <= -TRIGGER_PX && onSwipeLeft) {
      onSwipeLeft()
    }
    reset()
  }

  return {
    offset,
    swiping: axisLocked.current === 'x' && offset !== 0,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
    },
  }
}
