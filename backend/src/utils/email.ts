import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mywarmly.app'

export async function sendTeamInviteEmail(to: string, teamName: string, inviterName: string): Promise<void> {
  const from = process.env.SMTP_FROM || 'Warmly <noreply@mywarmly.app>'
  const signupUrl = `${FRONTEND_URL}/signup?email=${encodeURIComponent(to)}`

  await transporter.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join "${teamName}" on Warmly`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #39E079; margin: 0; font-size: 28px;">Warmly</h1>
        </div>
        <h2 style="color: #333; font-size: 20px; margin-bottom: 16px;">You're invited to a team!</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.5;">
          <strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong> on Warmly — a personal CRM for managing your professional relationships.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${signupUrl}" style="background: #39E079; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Join Warmly
          </a>
        </div>
        <p style="color: #999; font-size: 13px; line-height: 1.5;">
          Once you create your account, you'll automatically be added to the team.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const from = process.env.SMTP_FROM || 'Warmly <noreply@mywarmly.app>'

  await transporter.sendMail({
    from,
    to,
    subject: 'Your Warmly Password Reset Code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #39E079; margin: 0; font-size: 28px;">Warmly</h1>
        </div>
        <h2 style="color: #333; font-size: 20px; margin-bottom: 16px;">Password Reset</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.5;">
          You requested a password reset for your Warmly account. Use the code below to reset your password. This code expires in 15 minutes.
        </p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
        </div>
        <p style="color: #999; font-size: 13px; line-height: 1.5;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
