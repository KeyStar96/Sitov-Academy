import Image from 'next/image'

/** One stable brand asset for marketing, registration and the learning space. */
export default function BrandLogo({ name, descriptor, compact = false }: {
  name: string
  descriptor?: string
  compact?: boolean
}) {
  return (
    <span className="academy-logo">
      <Image src="/Bilder/favicon.png" alt="" width={40} height={40} priority className="academy-logo-mark" />
      {!compact && <span className="min-w-0"><span className="academy-logo-name">{name}</span>{descriptor && <span className="academy-logo-descriptor">{descriptor}</span>}</span>}
      {compact && <span className="sr-only">{name}</span>}
    </span>
  )
}
