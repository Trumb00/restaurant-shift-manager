import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, schedulePublishedEmail, vacationRequestEmail, vacationReviewedEmail, absenceNotificationEmail } from '@/lib/email'

// This route is called by a cron job or internal trigger to process pending notifications
export async function POST(request: NextRequest) {
  // Verify internal secret to prevent abuse
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Fetch pending email notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select(`
      id, type, title, body, channel,
      employees!recipient_id(email, first_name, last_name)
    `)
    .eq('status', 'pending')
    .eq('channel', 'email')
    .limit(50)

  if (!notifications || notifications.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0

  for (const notif of notifications) {
    const emp = Array.isArray(notif.employees) ? notif.employees[0] : notif.employees
    if (!emp?.email) continue

    let html = `<p>${notif.body}</p>`

    // Build type-specific templates
    switch (notif.type) {
      case 'schedule_published':
        html = schedulePublishedEmail(`${emp.first_name} ${emp.last_name}`, '', '')
        break
      case 'vacation_request':
        html = `<p>${notif.body}</p>`
        break
      case 'vacation_approved':
      case 'vacation_rejected':
        html = `<p>${notif.body}</p>`
        break
      case 'absence_reported':
        html = `<p>${notif.body}</p>`
        break
    }

    await sendEmail({
      to: emp.email,
      subject: notif.title,
      html,
    })

    await supabase
      .from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', notif.id)

    processed++
  }

  return NextResponse.json({ processed })
}
