import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NOTIFY_EMAIL = 'info@sitov-academy.com'

/**
 * Format a timestamptz string to a readable German date/time.
 * Input: "2026-03-01T15:00:00+01:00" or similar ISO string
 * Output: "01.03.2026 um 15:00 Uhr"
 */
function formatDateTime(isoString: string): string {
    try {
        const date = new Date(isoString)
        const pad = (n: number) => n.toString().padStart(2, '0')
        const day = pad(date.getDate())
        const month = pad(date.getMonth() + 1)
        const year = date.getFullYear()
        const hours = pad(date.getHours())
        const minutes = pad(date.getMinutes())
        return `${day}.${month}.${year} um ${hours}:${minutes} Uhr`
    } catch {
        return isoString || 'Unbekannt'
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("notify-new-enrollment: Edge Function invoked.")

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing environment variables (RESEND_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY)")
        }

        const resend = new Resend(RESEND_API_KEY)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // Parse webhook payload
        const payload = await req.json()
        console.log("Webhook payload received:", JSON.stringify(payload))

        const { type, table, record } = payload

        if (type !== 'INSERT') {
            return new Response(JSON.stringify({ message: `Ignored event type: ${type}` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        let participantName = ''
        let participantEmail = ''
        let courseName = ''
        let enrollmentType = ''
        let createdAt = ''

        // ─── TRIAL LESSONS ───────────────────────────────────────────
        if (table === 'trial_lessons') {
            enrollmentType = 'Probestunde'
            participantName = `${record.first_name || ''} ${record.last_name || ''}`.trim()
            participantEmail = record.email || 'Keine E-Mail'
            createdAt = formatDateTime(record.created_at)

            // Fetch course name
            if (record.course_id) {
                const { data: course } = await supabase
                    .from('courses')
                    .select('title, translation_key')
                    .eq('id', record.course_id)
                    .single()

                courseName = course?.title || course?.translation_key || record.course_id
            } else {
                courseName = 'Kein Kurs angegeben'
            }

            // ─── REGISTRATIONS ───────────────────────────────────────────
        } else if (table === 'registrations') {
            enrollmentType = 'Festanmeldung'
            createdAt = formatDateTime(record.created_at)

            // Fetch user data via user_id
            if (record.user_id) {
                const { data: user } = await supabase
                    .from('users')
                    .select('first_name, last_name, email')
                    .eq('id', record.user_id)
                    .single()

                if (user) {
                    participantName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
                    participantEmail = user.email || 'Keine E-Mail'
                } else {
                    participantName = 'Unbekannt'
                    participantEmail = 'Keine E-Mail'
                }
            } else {
                participantName = 'Unbekannt (kein user_id)'
                participantEmail = 'Keine E-Mail'
            }

            // Fetch course names from course_ids array
            const courseIds: string[] = record.course_ids || []
            if (courseIds.length > 0) {
                const { data: courses } = await supabase
                    .from('courses')
                    .select('id, title, translation_key')
                    .in('id', courseIds)

                if (courses && courses.length > 0) {
                    courseName = courses.map((c: any) => c.title || c.translation_key || c.id).join(', ')
                } else {
                    courseName = courseIds.join(', ')
                }
            } else {
                courseName = 'Keine Kurse ausgewählt'
            }

        } else {
            return new Response(JSON.stringify({ message: `Ignored table: ${table}` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // ─── BUILD EMAIL ─────────────────────────────────────────────
        const subject = `Neue Anmeldung: ${participantName} – ${courseName}`

        const emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neue Anmeldung</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; color: #374151; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: #0F172A; padding: 32px 40px; text-align: center; }
        .header h1 { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.025em; }
        .content { padding: 40px; }
        .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px; }
        .badge-trial { background-color: #DBEAFE; color: #1E40AF; }
        .badge-regular { background-color: #D1FAE5; color: #065F46; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .info-table td { padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 15px; line-height: 1.5; vertical-align: top; }
        .info-table td:first-child { color: #9ca3af; font-weight: 600; width: 100px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
        .info-table td:last-child { color: #111827; }
        .footer { background-color: #f9fafb; padding: 24px 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
        @media only screen and (max-width: 600px) {
            .container { margin: 0; border-radius: 0; }
            .content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Neue Kursanmeldung eingegangen</h1>
        </div>
        <div class="content">
            <span class="badge ${enrollmentType === 'Probestunde' ? 'badge-trial' : 'badge-regular'}">
                ${enrollmentType}
            </span>

            <table class="info-table">
                <tr>
                    <td>Wer</td>
                    <td><strong>${participantName}</strong><br>${participantEmail}</td>
                </tr>
                <tr>
                    <td>Was</td>
                    <td>${courseName}</td>
                </tr>
                <tr>
                    <td>Typ</td>
                    <td>${enrollmentType}</td>
                </tr>
                <tr>
                    <td>Wann</td>
                    <td>${createdAt}</td>
                </tr>
            </table>
        </div>
        <div class="footer">
            Diese Nachricht wurde automatisch generiert.<br>
            Sitov Academy
        </div>
    </div>
</body>
</html>
        `

        // ─── SEND EMAIL ──────────────────────────────────────────────
        console.log(`Sending notification email. Subject: "${subject}"`)

        const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'Sitov Academy <info@sitov-academy.com>',
            to: [NOTIFY_EMAIL],
            subject: subject,
            html: emailHtml,
        })

        if (emailError) {
            console.error("Resend error:", emailError)
            return new Response(JSON.stringify({ success: false, error: emailError }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`Notification email sent successfully. ID: ${emailData?.id}`)

        return new Response(JSON.stringify({
            success: true,
            message: `Notification sent for ${enrollmentType}: ${participantName}`,
            emailId: emailData?.id,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error("notify-new-enrollment error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
