import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { teacherInitials, teacherPortrait } from '@/lib/teacher-portraits'
import { cn } from '@/lib/utils'

/** Foto der Lehrkraft, sonst ihre Initialen, sonst ein neutrales Symbol. Rein dekorativ: Der Name steht immer daneben. */
export default function TeacherAvatar({ name, size = 56, className }: { name: string | null; size?: number; className?: string }) {
  const portrait = teacherPortrait(name)
  const initials = teacherInitials(name)
  return (
    <span aria-hidden="true" className={cn('st-avatar', className)} style={{ width: size, height: size }}>
      {portrait ? <Image src={portrait} alt="" width={size * 2} height={size * 2} className="st-avatar__photo" />
        : initials ? <span className="st-avatar__initials" style={{ fontSize: size * 0.36 }}>{initials}</span>
          : <UserRound size={size * 0.5} />}
    </span>
  )
}
