import React from 'react'
import { computeVisualDiff } from '@/lib/visual-diff'
import { cn } from '@/lib/utils'

interface VisualDiffProps {
  actual: string
  expected: string
  className?: string
}

/**
 * A UI component that displays the differences between an actual input and the expected solution.
 * Missing words are rendered in green, wrong words in red strikethrough, and correct words normally.
 */
export default function VisualDiff({ actual, expected, className }: VisualDiffProps) {
  const diffChunks = computeVisualDiff(actual, expected)

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-x-1 text-lg leading-relaxed", className)}>
      {diffChunks.map((chunk, index) => {
        const isSpace = /^\s+$/.test(chunk.value)
        if (isSpace) {
          return <span key={index} className="whitespace-pre">{chunk.value}</span>
        }

        if (chunk.status === 'wrong') {
          return (
            <span key={index} className="text-red-500 line-through decoration-red-500 font-medium">
              {chunk.value}
            </span>
          )
        }
        
        if (chunk.status === 'missing') {
          return (
            <span key={index} className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
              {chunk.value}
            </span>
          )
        }

        return (
          <span key={index} className="text-[var(--foreground)] font-medium">
            {chunk.value}
          </span>
        )
      })}
    </div>
  )
}
