import { certificateActor, certificateErrorResponse, certificateHeaders, issueCertificate, readCertificateRequest, requireCertificateOrigin } from '@/lib/certificates/issuance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    requireCertificateOrigin(request)
    const input = await readCertificateRequest(request)
    const actor = await certificateActor()
    const id = await issueCertificate(actor, input.month)
    return Response.json({ id }, { status: 201, headers: certificateHeaders })
  } catch (error: unknown) { return certificateErrorResponse(error) }
}
