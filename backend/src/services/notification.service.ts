import nodemailer from 'nodemailer';

// =============================================================================
// Nodemailer Transporter — Initialized Once (Singleton)
// =============================================================================
// The transporter is created once at module-load time.  nodemailer reuses the
// underlying SMTP connection pool across all sendMail() calls, so this is both
// safe and the recommended pattern.
//
// Gmail quick-start:
//   1. Enable 2-Step Verification on your Google Account.
//   2. Go to https://myaccount.google.com/apppasswords
//   3. Generate an App Password (name it "CareerNest SMTP").
//   4. Set SMTP_USER=you@gmail.com and SMTP_PASS=<the 16-char app password>
//      in your .env file.  DO NOT use your normal Gmail password here.
//
// For local smoke-testing without any SMTP server, swap to Ethereal:
//   const testAccount = await nodemailer.createTestAccount();
//   and set SMTP_HOST=smtp.ethereal.email / SMTP_USER & SMTP_PASS from that.
// =============================================================================
const transporter = nodemailer.createTransport({
  host:   process.env['SMTP_HOST'] ?? 'smtp.gmail.com',
  port:   Number(process.env['SMTP_PORT'] ?? 587),
  secure: Number(process.env['SMTP_PORT'] ?? 587) === 465, // true only for port 465 (TLS)
  auth: {
    user: process.env['SMTP_USER'] ?? '',
    pass: process.env['SMTP_PASS'] ?? '',
  },
});

// =============================================================================
// buildApplicationHtml — HTML email template
// =============================================================================
// Returns a self-contained HTML string.  Inline styles are used intentionally:
// many email clients (Gmail, Outlook) strip <style> tags, so inline CSS is the
// only reliable way to control rendering across clients.
// =============================================================================
function buildApplicationHtml(jobTitle: string, matchScore: number): string {
  const scoreColor =
    matchScore >= 80 ? '#22c55e'   // green
    : matchScore >= 60 ? '#f59e0b' // amber
    : '#ef4444';                   // red

  return /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Application Confirmed — CareerNest</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);
                        padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;
                          letter-spacing:-0.5px;">🎓 CareerNest</h1>
              <p  style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                Smart Placement &amp; Internship Portal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;font-weight:600;">
                ✅ Application Submitted!
              </h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Great news! Your application for the position below has been
                received and is now under review by the recruiter.
              </p>

              <!-- Job card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;
                             border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;
                                font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                      Position Applied For
                    </p>
                    <p style="margin:0;color:#1e293b;font-size:18px;font-weight:700;">
                      ${jobTitle}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Match score badge -->
              <table role="presentation" cellspacing="0" cellpadding="0"
                     style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;
                              border-radius:12px;padding:20px 28px;text-align:center;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;
                                font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                      Your AI Match Score
                    </p>
                    <p style="margin:0;font-size:48px;font-weight:800;color:${scoreColor};">
                      ${matchScore}%
                    </p>
                    <p style="margin:6px 0 0;color:#64748b;font-size:13px;">
                      ${
                        matchScore >= 80
                          ? '🌟 Excellent match — you\'re a top candidate!'
                          : matchScore >= 60
                          ? '👍 Good match — keep building your skills!'
                          : '💡 Fair match — review the job requirements.'
                      }
                    </p>
                  </td>
                </tr>
              </table>

              <!-- What happens next -->
              <h3 style="margin:0 0 12px;color:#1e293b;font-size:16px;font-weight:600;">
                What happens next?
              </h3>
              <ul style="margin:0 0 28px;padding-left:20px;color:#475569;
                          font-size:14px;line-height:1.8;">
                <li>The recruiter will review your profile and resume.</li>
                <li>You will receive an email if you are shortlisted.</li>
                <li>Track all your applications on your CareerNest dashboard.</li>
              </ul>

              <a href="#"
                 style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                         color:#ffffff;text-decoration:none;font-weight:600;
                         font-size:15px;padding:14px 32px;border-radius:8px;">
                View My Applications →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;
                        border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                © 2024 CareerNest · You are receiving this because you applied via CareerNest.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// =============================================================================
// sendApplicationConfirmation
// =============================================================================
// Fires and forgets — the caller should NOT await this if they want to avoid
// blocking the HTTP response.  Use: void sendApplicationConfirmation(...)
//
// Failure mode: Logs the error and returns; NEVER throws.  The application is
// already saved in the DB by the time this is called, so an email failure
// must not roll back or error out the HTTP response.
// =============================================================================
export async function sendApplicationConfirmation(
  studentEmail: string,
  jobTitle:     string,
  matchScore:   number,
): Promise<void> {
  // Silently skip if SMTP is not configured (e.g. CI / early dev)
  if (!process.env['SMTP_USER'] || !process.env['SMTP_PASS']) {
    console.warn(
      '[Notification] SMTP_USER or SMTP_PASS not set — skipping confirmation email.',
    );
    return;
  }

  try {
    const info = await transporter.sendMail({
      from:    `"CareerNest" <${process.env['SMTP_USER']}>`,
      to:      studentEmail,
      subject: `✅ Application Confirmed: ${jobTitle} — CareerNest`,
      html:    buildApplicationHtml(jobTitle, matchScore),
      // Plain-text fallback for email clients that don't render HTML
      text: [
        `CareerNest — Application Confirmed`,
        ``,
        `You have successfully applied for: ${jobTitle}`,
        `Your AI match score: ${matchScore}%`,
        ``,
        `The recruiter will review your profile and contact you if shortlisted.`,
        `Log in to CareerNest to track your application status.`,
      ].join('\n'),
    });

    console.log(
      `[Notification] Email sent to ${studentEmail} — messageId: ${info.messageId}`,
    );
  } catch (error) {
    // Log the failure but do NOT rethrow — email is non-critical infrastructure.
    // The application record is already committed to MongoDB at this point.
    console.error('[Notification] Failed to send confirmation email:', error);
  }
}

// =============================================================================
// sendWhatsAppAlert
// =============================================================================
// Production: sends a real WhatsApp message via the Twilio Messaging API.
// Development: logs the message locally — zero API credits consumed.
//
// To activate production mode:
//   1. Sign up at https://www.twilio.com and get a WhatsApp-enabled number.
//   2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.
//   3. Deploy with NODE_ENV=production.
//
// phoneNumber format: E.164 international format, e.g. "+919876543210"
// =============================================================================
export async function sendWhatsAppAlert(
  phoneNumber: string,
  message:     string,
): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    // ── Live Twilio path ─────────────────────────────────────────────────────
    // Twilio is a CommonJS package; we use a dynamic import to stay ESM-safe.
    const accountSid = process.env['TWILIO_ACCOUNT_SID'];
    const authToken  = process.env['TWILIO_AUTH_TOKEN'];
    const from       = process.env['TWILIO_PHONE_NUMBER'];

    if (!accountSid || !authToken || !from) {
      console.error(
        '[Notification] Twilio credentials missing — WhatsApp message not sent.',
      );
      return;
    }

    try {
      // Dynamic import keeps twilio as a runtime-only optional dep.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twilioModule = await import('twilio' as string) as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const client = (twilioModule.default ?? twilioModule)(accountSid, authToken);

      const result = await client.messages.create({
        from: `whatsapp:${from}`,
        to:   `whatsapp:${phoneNumber}`,
        body: message,
      });

      console.log(
        `[Notification] WhatsApp sent to ${phoneNumber} — SID: ${result.sid}`,
      );
    } catch (error) {
      console.error('[Notification] Failed to send WhatsApp alert:', error);
    }
  } else {
    // ── Development mock path ────────────────────────────────────────────────
    // Outputs to console so you can verify the correct data is being passed
    // without spending Twilio credits or requiring a live API key.
    console.log(
      `[MOCK WHATSAPP to ${phoneNumber}]: ${message}`,
    );
  }
}
