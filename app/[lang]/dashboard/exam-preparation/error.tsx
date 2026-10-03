'use client'
export default function ExamError({reset}:{reset:()=>void}){return <section className="space-y-4"><h1 className="text-2xl font-bold">Dein Prüfungstrainer konnte nicht geladen werden</h1><p>Bitte versuche es erneut. Deine gespeicherten Antworten bleiben erhalten.</p><button onClick={reset} className="st-button st-button--primary">Erneut laden</button></section>}
