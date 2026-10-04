'use client'

export default function AcademySkipLink({ label }: { label: string }) {
  return <a className="academy-skip-link" href="#main-content">
    {label}
  </a>
}
