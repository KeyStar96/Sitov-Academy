import { computeVisualDiff } from '@/lib/visual-diff'
import { cn } from '@/lib/utils'

interface VisualDiffProps {
  actual: string
  expected: string
  className?: string
}

/** The complete correct sentence, with only changed/missing characters in red. */
export default function VisualDiff({ actual, expected, className }: VisualDiffProps) {
  return (
    <p className={cn('whitespace-pre-wrap break-words text-lg leading-relaxed text-[var(--foreground)]', className)}>
      {computeVisualDiff(actual, expected).map((chunk, index) => (
        <span key={index} className={chunk.status === 'correct' ? undefined : 'font-bold text-[var(--danger)]'}>
          {chunk.value}
        </span>
      ))}
    </p>
  )
}
