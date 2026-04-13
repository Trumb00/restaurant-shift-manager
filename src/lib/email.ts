import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
  return _resend
}

const FROM = process.env.FROM_EMAIL ?? 'turni@restaurant.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping email send.')
    return
  }
  const { error } = await getResend().emails.send({
    from: FROM,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
  })
  if (error) {
    console.error('[email] Failed to send:', error)
  }
}

// ── Email templates ─────────────────────────────────────────────────────────

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GestioneTurni</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background: #4f46e5; padding: 24px 32px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">🍽️ GestioneTurni</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
        <a href="${APP_URL}/dashboard" style="color: #4f46e5; text-decoration: none; font-size: 13px;">Apri l'app →</a>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function schedulePublishedEmail(employeeName: string, weekStart: string, weekEnd: string): string {
  return baseLayout(`
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ciao <strong>${employeeName}</strong>,</p>
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
      I tuoi turni per la settimana <strong>${weekStart} – ${weekEnd}</strong> sono stati pubblicati.
    </p>
    <a href="${APP_URL}/dashboard/turni" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Vedi i miei turni
    </a>
  `)
}

export function vacationRequestEmail(managerName: string, employeeName: string, type: string, startDate: string, endDate: string): string {
  return baseLayout(`
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ciao <strong>${managerName}</strong>,</p>
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
      <strong>${employeeName}</strong> ha inviato una richiesta di <strong>${type}</strong>:
    </p>
    <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 16px;">
      <p style="margin: 0; font-size: 14px; color: #374151;">Dal: <strong>${startDate}</strong></p>
      <p style="margin: 4px 0 0; font-size: 14px; color: #374151;">Al: <strong>${endDate}</strong></p>
    </div>
    <a href="${APP_URL}/dashboard/ferie" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Gestisci la richiesta
    </a>
  `)
}

export function vacationReviewedEmail(employeeName: string, approved: boolean, type: string, startDate: string, endDate: string, notes?: string): string {
  const color = approved ? '#10b981' : '#ef4444'
  const label = approved ? '✅ Approvata' : '❌ Rifiutata'
  return baseLayout(`
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ciao <strong>${employeeName}</strong>,</p>
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
      La tua richiesta di <strong>${type}</strong> (${startDate} – ${endDate}) è stata:
    </p>
    <p style="font-size: 20px; font-weight: 700; color: ${color}; margin: 0 0 16px;">${label}</p>
    ${notes ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">Nota: <em>${notes}</em></p>` : ''}
    <a href="${APP_URL}/dashboard/ferie" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Vai alle ferie
    </a>
  `)
}

export interface ShiftEmailRow {
  date: string        // 'YYYY-MM-DD'
  slotName: string
  startTime: string   // 'HH:MM'
  endTime: string
}

export function scheduleUpdatedEmail(
  employeeName: string,
  weekStart: string,
  weekEnd: string,
  shifts: ShiftEmailRow[],
): string {
  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    })

  const shiftRows = shifts
    .map(s => `
      <tr>
        <td style="padding: 8px 12px; font-size: 14px; color: #374151; border-bottom: 1px solid #f1f5f9; text-transform: capitalize;">${fmtDate(s.date)}</td>
        <td style="padding: 8px 12px; font-size: 14px; color: #374151; border-bottom: 1px solid #f1f5f9;">${s.slotName}</td>
        <td style="padding: 8px 12px; font-size: 14px; color: #374151; border-bottom: 1px solid #f1f5f9; white-space: nowrap;">${s.startTime} – ${s.endTime}</td>
      </tr>`)
    .join('')

  const tableOrEmpty = shifts.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin: 0 0 16px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left; border-bottom: 1px solid #e2e8f0;">Giorno</th>
            <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left; border-bottom: 1px solid #e2e8f0;">Fascia</th>
            <th style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-align: left; border-bottom: 1px solid #e2e8f0;">Orario</th>
          </tr>
        </thead>
        <tbody>${shiftRows}</tbody>
      </table>`
    : `<p style="color: #6b7280; font-size: 14px; font-style: italic; margin: 0 0 16px;">Nessun turno assegnato questa settimana.</p>`

  return baseLayout(`
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ciao <strong>${employeeName}</strong>,</p>
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
      I tuoi turni per la settimana <strong>${weekStart} – ${weekEnd}</strong> sono stati aggiornati.
      Ecco il tuo programma completo:
    </p>
    ${tableOrEmpty}
    <a href="${APP_URL}/dashboard/turni" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Vedi i miei turni
    </a>
  `)
}

export function setPasswordEmail(employeeName: string, actionLink: string): string {
  return baseLayout(`
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ciao <strong>${employeeName}</strong>,</p>
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
      Sei stato aggiunto a <strong>GestioneTurni</strong>. Clicca il pulsante qui sotto per impostare la tua password e accedere all&apos;app.
    </p>
    <a href="${actionLink}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Imposta la password
    </a>
    <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">Il link scade tra 24 ore.</p>
  `)
}

export function absenceNotificationEmail(managerName: string, employeeName: string, date: string, slotName: string, reason: string): string {
  return baseLayout(`
    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Ciao <strong>${managerName}</strong>,</p>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 16px;">
      <p style="margin: 0; font-size: 14px; color: #374151; font-weight: 600;">⚠️ Assenza segnalata</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #374151;"><strong>${employeeName}</strong> è assente il ${date} (${slotName})</p>
      ${reason ? `<p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Motivo: ${reason}</p>` : ''}
    </div>
    <a href="${APP_URL}/dashboard/assenze" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      Gestisci le assenze
    </a>
  `)
}
