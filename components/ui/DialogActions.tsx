import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** R15: DOM, keyboard and visual order agree; the primary action is last. */
export default function DialogActions({ secondary, primary, className }: {
  secondary: ReactNode
  primary: ReactNode
  className?: string
}) {
  return <div className={cn('grid gap-3 sm:grid-cols-2', className)}>{secondary}{primary}</div>
}
