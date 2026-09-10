import { cn } from '@/lib/utils'

export default function AppBackground({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('academy-app-background absolute inset-0 pointer-events-none', className)} />
}
