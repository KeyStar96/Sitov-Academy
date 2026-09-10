import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("Trial Confirmation Edge Function invoked.")

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing environment variables")
        }

        const resend = new Resend(RESEND_API_KEY)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // Fetch confirmed trial lessons that haven't been emailed yet
        const { data: trials, error } = await supabase
            .from('trial_lessons')
            .select('*, courses(title, translation_key)')
            .eq('status', 'confirmed')
            .eq('confirmation_mail_sent', false)
            .limit(50)

        if (error) {
            console.error("Query Error:", error)
            throw error
        }

        if (!trials || trials.length === 0) {
            return new Response(JSON.stringify({ message: 'No confirmed trial lessons to process.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const results = []
        const logoUrl = 'https://www.sitov-academy.com/Bilder/favicon.png'

        for (const trial of trials) {
            const courseName = trial.courses?.title || trial.courses?.translation_key || 'Deutschkurs'

            // Format trial_date for display
            let formattedDate = trial.trial_date
            try {
                const dateStr = String(trial.trial_date).split('T')[0]
                const [y, m, d] = dateStr.split('-').map(Number)
                const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
                const dateObj = new Date(y, m - 1, d)
                const dayName = dayNames[dateObj.getDay()]
                formattedDate = `${dayName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
            } catch (e) {
                console.error("Date formatting error:", e)
            }

            const emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Probestunde bestätigt</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f5ef; margin: 0; padding: 0; color: #374151; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: #ffffff; padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #bd3510; }
        .logo { height: 50px; width: auto; }
        .content { padding: 40px; }
        .h1 { color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 24px; text-align: center; letter-spacing: -0.025em; }
        .text { font-size: 16px; line-height: 1.6; margin-bottom: 24px; color: #4b5563; }
        .highlight-box { background-color: #FFF4EC; border: 1px solid #FFD8C2; border-radius: 8px; padding: 24px; margin-bottom: 32px; text-align: center; }
        .highlight-course { color: #9C3800; font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .highlight-date { color: #bd3510; font-size: 22px; font-weight: 800; margin-top: 8px; }
        .footer { background-color: #24272a; padding: 40px; text-align: center; color: #94A3B8; font-size: 13px; line-height: 1.6; }
        .footer a { color: #CBD5E1; text-decoration: none; }
        .footer a:hover { color: #ffffff; text-decoration: underline; }
        .copyright { margin-top: 24px; padding-top: 24px; border-top: 1px solid #1E293B; color: #64748B; font-size: 12px; }
        @media only screen and (max-width: 600px) {
            .container { margin: 0; border-radius: 0; }
            .content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${logoUrl}" alt="" width="50" height="50" class="logo" style="display:block;width:50px;height:50px;margin:0 auto 12px;">
            <div style="font-size:26px;line-height:1.2;font-weight:bold;color:#24272a;">Sitov Academy</div>
        </div>
        <div class="content">
            <h1 class="h1">Deine Probestunde ist bestätigt! 🎉</h1>
            
            <p class="text">
                Hallo ${trial.first_name || 'Student'},
            </p>
            
            <p class="text">
                wir freuen uns sehr, dass du eine Probestunde bei Sitov Academy ausprobieren möchtest!
            </p>

            <div class="highlight-box">
                <div class="highlight-course">${courseName}</div>
                <div class="highlight-date">📅 ${formattedDate}</div>
            </div>

            <p class="text">
                Bitte komme pünktlich zum Unterricht. Falls du Fragen hast oder den Termin verschieben musst, antworte einfach auf diese E-Mail.
            </p>

            <p class="text">
                Wir freuen uns auf dich!
            </p>

            <p class="text" style="font-weight: 600; margin-top: 32px;">
                Dein Sitov Academy Team
            </p>
        </div>
        <div class="footer">
            <p style="margin-bottom: 16px;">
                <strong>Sitov Academy</strong>
            </p>
            <p style="margin-bottom: 16px;">
                <strong>Präsenzunterricht</strong><br>
                Freizeitheim Vahrenwald<br>
                Vahrenwalder Str. 92 • 30165 Hannover
            </p>
            <p style="margin-bottom: 16px;">
                <strong>Sitz der Sprachschule</strong><br>
                Hüttenstraße 24a • 30165 Hannover
            </p>
            <p style="margin-bottom: 8px;">
                <a href="mailto:info@sitov-academy.com">info@sitov-academy.com</a><br>
                <a href="tel:+491714758620">+49 171 4758620</a>
            </p>
            <div class="copyright">
                &copy; 2026 Sitov Academy. Alle Rechte vorbehalten.<br>
                Vertretungsberechtigt: Anastasia Sitov<br><br>
                <a href="https://www.sitov-academy.com/de/imprint">Impressum</a> •
                <a href="https://www.sitov-academy.com/de/privacy">Datenschutz</a> •
                <a href="https://www.sitov-academy.com/de/agb">AGB</a>
            </div>
        </div>
    </div>
</body>
</html>
            `

            const { data: emailData, error: emailError } = await resend.emails.send({
                from: 'Sitov Academy <info@sitov-academy.com>',
                to: [trial.email],
                subject: `Deine Probestunde ist bestätigt – ${formattedDate}`,
                html: emailHtml,
            })

            if (emailError) {
                console.error(`Error sending to ${trial.email}:`, emailError)
                results.push({ id: trial.id, status: 'failed', error: emailError })
            } else {
                console.log(`Email sent to ${trial.email}. ID: ${emailData?.id}`)

                const { error: updateError } = await supabase
                    .from('trial_lessons')
                    .update({ confirmation_mail_sent: true })
                    .eq('id', trial.id)

                if (updateError) {
                    results.push({ id: trial.id, status: 'sent_but_update_failed', error: updateError })
                } else {
                    results.push({ id: trial.id, status: 'success', emailId: emailData?.id })
                }
            }
        }

        return new Response(JSON.stringify({ message: `Processed ${trials.length} trial confirmations`, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
