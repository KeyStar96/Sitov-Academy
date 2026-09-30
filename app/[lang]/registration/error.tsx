'use client'

import AuthErrorState from '@/components/auth/AuthErrorState'

/** Missing course cancellations must block enrollment with a localized retry. */
export default function RegistrationError({ retry }: { error: Error; retry: () => void }) {
  return <AuthErrorState reset={retry} />
}
