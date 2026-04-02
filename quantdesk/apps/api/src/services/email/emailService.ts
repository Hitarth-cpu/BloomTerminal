import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'BloomTerminal <onboarding@resend.dev>';
const APP_URL = process.env.FRONTEND_URL ?? 'https://bloom-terminal.vercel.app';

export async function sendInvitationEmail(opts: {
  to: string;
  firstName?: string;
  inviterName: string;
  orgName: string;
  token: string;
  role: string;
  expiryHours: number;
}): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return { sent: false };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { to, firstName, inviterName, orgName, token, role, expiryHours } = opts;
  const link = `${APP_URL}/invite?token=${token}`;
  const name = firstName ?? to.split('@')[0];

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `You've been invited to join ${orgName} on BloomTerminal`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:40px;max-width:520px;margin:0 auto">
  <div style="border:1px solid #222;padding:32px;border-radius:4px">
    <div style="font-size:22px;font-weight:700;margin-bottom:4px">
      <span style="color:#fff">Bloom</span><span style="color:#ff6600">Terminal</span>
    </div>
    <div style="font-size:11px;color:#888;letter-spacing:2px;margin-bottom:32px">INSTITUTIONAL TRADING PLATFORM</div>

    <p style="color:#ccc;line-height:1.6">Hi ${name},</p>
    <p style="color:#ccc;line-height:1.6">
      <strong style="color:#fff">${inviterName}</strong> has invited you to join
      <strong style="color:#fff">${orgName}</strong> on BloomTerminal as a <strong style="color:#ff6600">${role}</strong>.
    </p>

    <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#ff6600;color:#000;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px">
      ACCEPT INVITATION →
    </a>

    <p style="color:#666;font-size:11px;line-height:1.6">
      This invitation expires in ${expiryHours} hours.<br>
      If you didn't expect this, you can safely ignore this email.
    </p>
    <p style="color:#555;font-size:11px;margin-top:16px;word-break:break-all">
      Or copy this link: ${link}
    </p>
  </div>
</body>
</html>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] Send failed:', (err as Error).message);
    return { sent: false };
  }
}
