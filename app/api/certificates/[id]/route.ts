import { z } from 'zod'
import { certificateActor, certificateErrorResponse, certificateHeaders, downloadCertificate } from '@/lib/certificates/issuance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await params).id)
    const actor = await certificateActor()
    const { bytes, filename } = await downloadCertificate(actor, id)
    return new Response(bytes, { headers: { ...certificateHeaders, 'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': String(bytes.length) } })
  } catch (error: unknown) { return certificateErrorResponse(error) }
}
