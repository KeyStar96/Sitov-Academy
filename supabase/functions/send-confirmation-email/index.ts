import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("Edge Function invoked. Checking environment variables...")

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!RESEND_API_KEY) {
            console.error("Missing RESEND_API_KEY")
            throw new Error("Missing RESEND_API_KEY")
        }
        if (!SUPABASE_URL) {
            console.error("Missing SUPABASE_URL")
            throw new Error("Missing SUPABASE_URL")
        }
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY")
            throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
        }

        console.log("Environment variables present. Initializing clients...")

        let resend;
        let supabase;

        try {
            resend = new Resend(RESEND_API_KEY)
            console.log("Resend client initialized.")
        } catch (e) {
            console.error("Failed to initialize Resend client:", e)
            throw e
        }

        try {
            supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            console.log("Supabase client initialized.")
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e)
            throw e
        }

        // 1. Fetch confirmed registrations that haven't been emailed yet
        console.log("Fetching confirmed registrations...")

        let registrations;
        try {
            // START Query
            const query = supabase
                .from('registrations')
                .select(`
                    *,
                    users (*),
                    enrollments (
                        price,
                        courses (
                            title,
                            translation_key,
                            price
                        )
                    )
                `)
                .eq('status', 'confirmed')
                .eq('confirmation_mail_sent', false)
                .limit(50);

            const { data, error } = await query;

            if (error) {
                console.error("Supabase Query Error:", JSON.stringify(error));
                throw error;
            }
            registrations = data;
            console.log(`Query successful. Found ${registrations?.length} registrations.`);

        } catch (err) {
            console.error("Crash during Supabase Query execution:", err);
            throw err;
        }

        if (!registrations || registrations.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No new confirmed registrations to process.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const results = []

        // 2. Process each registration
        for (const reg of registrations) {
            console.log(`Processing registration ${reg.id}...`);

            // Handle 'users' being potentially an array or object depending on Supabase client version/setup
            const user = Array.isArray(reg.users) ? reg.users[0] : reg.users;

            // Debug log to see what we actually got
            console.log(`User data for ${reg.id}:`, JSON.stringify(user));

            const courses = reg.enrollments?.map((e: any) => e.courses) || [];
            console.log(`Found ${courses.length} courses for ${reg.id}`);
            if (!user || !user.email) {
                console.error(`User data missing/incomplete for registration ${reg.id}`);
                continue;
            }

            // Format course list for email with real names from DB and dynamic prices
            const courseListHtml = (reg.enrollments || []).map((e: any) => {
                const c = e.courses;
                const realTitle = c?.title || c?.translation_key || 'Unbekannter Kurs';

                // Use specific enrollment price if available, otherwise fallback to course price
                const finalPrice = (typeof e?.price === 'number') ? e.price : c?.price;
                const priceLabel = (typeof finalPrice === 'number') ? finalPrice.toFixed(2) : '0.00';

                return `
                <tr>
                    <td class="td">${realTitle}</td>
                    <td class="td td-price">${priceLabel}€</td>
                </tr>`;
            }).join('');

            // Use the current website brand mark with an accessible HTML wordmark.
            const logoUrl = 'https://www.sitov-academy.com/Bilder/favicon.png';

            // Calculate Payment Period (Start Date - End of Month)
            let periodString = '';
            try {
                if (reg.start_date) {
                    let d, m, y;
                    // Handle potential ISO string "YYYY-MM-DDTHH:mm:ss" by taking only the date part
                    const dateStr = String(reg.start_date).split('T')[0];

                    // Handle different formats (YYYY-MM-DD from DB or DD.MM.YYYY from input)
                    if (dateStr.includes('-')) {
                        [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
                    } else {
                        [d, m, y] = dateStr.split('.').map(n => parseInt(n, 10));
                    }

                    if (!d || !m || !y || isNaN(d) || isNaN(m) || isNaN(y)) {
                        console.error(`Invalid date components parsed from "${reg.start_date}":`, { d, m, y });
                        throw new Error("Invalid date format");
                    }

                    // Get last day of the month
                    // month is 0-indexed in JS Date constructor (0=Jan, 1=Feb, 2=Mar, etc.)
                    // BUT new Date(year, monthIndex, 0) returns the last day of the *previous* month.
                    // If m is parsed from "02" (Feb), it is 2.
                    // new Date(y, 2, 0) is last day of Feb (month index 2 is Mar).
                    const lastDay = new Date(y, m, 0).getDate();

                    const pad = (n: number) => n.toString().padStart(2, '0');
                    const formattedStart = `${pad(d)}.${pad(m)}.${y}`;
                    const formattedEnd = `${pad(lastDay)}.${pad(m)}.${y}`;

                    periodString = `${formattedStart} bis ${formattedEnd}`;
                }
            } catch (e) {
                console.error("Error formatting date period:", e);
                // Fallback: Try to format the raw string nicely if possible, or just show it
                periodString = reg.start_date || 'N/A';
            }

            // Payment Info Box
            const infoBoxHtml = `
            <div class="info-box">
                <h3 class="info-title">Nächste Schritte & Zahlung</h3>
                <p class="info-text" style="font-weight: bold; margin-bottom: 12px;">
                    Leistungszeitraum: ${periodString}
                </p>
                <p class="info-text">
                    Du erhältst in Kürze eine separate E-Mail mit der offiziellen Rechnung von <strong>Papierkram.de</strong>. 
                    Bitte überweise den Betrag erst nach Erhalt dieser Rechnung vor Kursbeginn.
                </p>
            </div>`;

            const emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anmeldebestätigung</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; color: #374151; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: #ffffff; padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #FF5C00; }
        .logo { height: 50px; width: auto; }
        .content { padding: 40px; }
        .h1 { color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 24px; text-align: center; letter-spacing: -0.025em; }
        .text { font-size: 16px; line-height: 1.6; margin-bottom: 24px; color: #4b5563; }
        .table { width: 100%; border-collapse: collapse; margin: 32px 0; }
        .th { text-align: left; padding: 12px 0; border-bottom: 2px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .td { padding: 16px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-size: 16px; }
        .td-price { text-align: right; font-family: monospace; font-weight: 600; }
        .total-row td { border-top: 2px solid #e5e7eb; border-bottom: none; font-weight: 700; font-size: 18px; padding-top: 20px; color: #111827; }
        .info-box { background-color: #FFF4EC; border: 1px solid #FFD8C2; border-radius: 8px; padding: 24px; margin-bottom: 32px; }
        .info-title { color: #9C3800; font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 8px; }
        .info-text { font-size: 14px; line-height: 1.5; color: #5C2B0D; margin: 0; }
        .footer { background-color: #0F172A; padding: 40px; text-align: center; color: #94A3B8; font-size: 13px; line-height: 1.6; }
        .footer a { color: #CBD5E1; text-decoration: none; transition: color 0.2s; }
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
        
        <!-- Header -->
        <div class="header">
            <img src="${logoUrl}" alt="" width="50" height="50" class="logo" style="display:block;width:50px;height:50px;margin:0 auto 12px;">
            <div style="font-size:26px;line-height:1.2;font-weight:bold;color:#24272a;">Sitov Academy</div>
        </div>

        <!-- Content -->
        <div class="content">
            <h1 class="h1">Anmeldebestätigung</h1>
            
            <p class="text">
                Hallo ${user.first_name || 'Student'},
            </p>
            
            <p class="text">
                vielen Dank für deine Anmeldung bei Sitov Academy! Wir haben deine Kursauswahl erhalten und bestätigt.
            </p>

            <!-- Course Table -->
            <table class="table">
                <thead>
                    <tr>
                        <th class="th">Kurs</th>
                        <th class="th" style="text-align: right;">Preis</th>
                    </tr>
                </thead>
                <tbody>
                    ${courseListHtml}
                    <tr class="total-row">
                        <td>Gesamtbetrag</td>
                        <td style="text-align: right;">${reg.total_price}€</td>
                    </tr>
                </tbody>
            </table>

            <!-- Payment Info Box -->
            ${infoBoxHtml}

            <p class="text">
                Falls du Fragen hast, antworte einfach auf diese E-Mail.<br>
                Wir freuen uns auf dich!
            </p>

            <p class="text" style="font-weight: 600; margin-top: 32px;">
                Dein Sitov Academy Team
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p style="margin-bottom: 16px;">
                <strong>Sitov Academy</strong><br>
                Hüttenstraße 24a • 30165 Hannover
            </p>
            <p style="margin-bottom: 8px;">
                <a href="mailto:info@sitov-academy.com">info@sitov-academy.com</a> • +49 171 4758620
            </p>
            <div class="copyright">
                &copy; 2026 Sitov Academy. Alle Rechte vorbehalten.<br>
                Vertretungsberechtigt: Anastasia Sitov<br><br>
                <a href="https://www.sitov-academy.com/imprint">Impressum</a> • 
                <a href="https://www.sitov-academy.com/privacy">Datenschutz</a> • 
                <a href="https://www.sitov-academy.com/agb">AGB</a>
            </div>
        </div>
    </div>
</body>
</html>
            `;

            console.log(`Attempting to send email to ${user.email}...`);

            // 3. Send Email
            const { data: emailData, error: emailError } = await resend.emails.send({
                from: 'Sitov Academy <info@sitov-academy.com>', // WARNING: This must be a VERIFIED domain in Resend!
                to: [user.email],
                subject: 'Deine Anmeldebestätigung - Sitov Academy',
                html: emailHtml,
            });

            if (emailError) {
                console.error(`RESEND ERROR for ${user.email}:`, JSON.stringify(emailError));
                results.push({ id: reg.id, status: 'failed', error: emailError });
            } else {
                console.log(`Email sent successfully to ${user.email}. ID: ${emailData?.id}`);

                // 4. Mark as sent
                const { error: updateError } = await supabase
                    .from('registrations')
                    .update({ confirmation_mail_sent: true })
                    .eq('id', reg.id);

                if (updateError) {
                    console.error(`DB Update Failed for ${reg.id}:`, updateError);
                    results.push({ id: reg.id, status: 'sent_but_update_failed', error: updateError });
                } else {
                    console.log(`DB updated (confirmation_mail_sent=true) for ${reg.id}`);
                    results.push({ id: reg.id, status: 'success', emailId: emailData?.id });
                }
            }
        }

        return new Response(
            JSON.stringify({ message: `Processed ${registrations.length} registrations`, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
