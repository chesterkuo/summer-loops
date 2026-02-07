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

// Email translations for contact invitation
const contactInviteTranslations: Record<string, {
  subject: (inviterName: string) => string
  greeting: (contactName: string) => string
  body1: (inviterName: string) => string
  body2: string
  cta: string
  iosApp: string
  footer: string
}> = {
  en: {
    subject: (inviterName) => `${inviterName} wants to stay connected on Warmly`,
    greeting: (contactName) => `Hi${contactName ? ` ${contactName}` : ''}!`,
    body1: (inviterName) => `<strong>${inviterName}</strong> just added you to their professional network on Warmly — a personal CRM for nurturing relationships that matter.`,
    body2: 'Join Warmly to stay connected and never lose touch with the people in your network.',
    cta: 'Join Warmly',
    iosApp: 'Download the iOS app',
    footer: 'Warmly helps you remember the people who matter in your professional life.',
  },
  'zh-TW': {
    subject: (inviterName) => `${inviterName} 想在 Warmly 上與你保持聯繫`,
    greeting: (contactName) => `嗨${contactName ? ` ${contactName}` : ''}！`,
    body1: (inviterName) => `<strong>${inviterName}</strong> 剛剛把你加入了他們在 Warmly 上的專業人脈網絡 — 一個幫助你維繫重要關係的個人 CRM。`,
    body2: '加入 Warmly，與你人脈中的重要人物保持聯繫，永不失聯。',
    cta: '加入 Warmly',
    iosApp: '下載 iOS App',
    footer: 'Warmly 幫助你記住職業生涯中重要的人。',
  },
  'zh-CN': {
    subject: (inviterName) => `${inviterName} 想在 Warmly 上与你保持联系`,
    greeting: (contactName) => `嗨${contactName ? ` ${contactName}` : ''}！`,
    body1: (inviterName) => `<strong>${inviterName}</strong> 刚刚把你加入了他们在 Warmly 上的专业人脉网络 — 一个帮助你维系重要关系的个人 CRM。`,
    body2: '加入 Warmly，与你人脉中的重要人物保持联系，永不失联。',
    cta: '加入 Warmly',
    iosApp: '下载 iOS App',
    footer: 'Warmly 帮助你记住职业生涯中重要的人。',
  },
  ja: {
    subject: (inviterName) => `${inviterName}さんがWarmlyであなたとつながりたいと思っています`,
    greeting: (contactName) => `こんにちは${contactName ? ` ${contactName}さん` : ''}！`,
    body1: (inviterName) => `<strong>${inviterName}</strong>さんがあなたをWarmlyのプロフェッショナルネットワークに追加しました — 大切な人間関係を育むパーソナルCRMです。`,
    body2: 'Warmlyに参加して、ネットワーク内の大切な人々とのつながりを保ちましょう。',
    cta: 'Warmlyに参加',
    iosApp: 'iOSアプリをダウンロード',
    footer: 'Warmlyは、あなたの職業人生で大切な人々を忘れないようお手伝いします。',
  },
  ko: {
    subject: (inviterName) => `${inviterName}님이 Warmly에서 연결을 원합니다`,
    greeting: (contactName) => `안녕하세요${contactName ? ` ${contactName}님` : ''}!`,
    body1: (inviterName) => `<strong>${inviterName}</strong>님이 Warmly에서 당신을 전문 네트워크에 추가했습니다 — 소중한 관계를 유지하는 개인 CRM입니다.`,
    body2: 'Warmly에 가입하여 네트워크의 소중한 사람들과 연결을 유지하세요.',
    cta: 'Warmly 가입하기',
    iosApp: 'iOS 앱 다운로드',
    footer: 'Warmly는 직업 생활에서 중요한 사람들을 기억하도록 도와줍니다.',
  },
  es: {
    subject: (inviterName) => `${inviterName} quiere mantenerse en contacto contigo en Warmly`,
    greeting: (contactName) => `¡Hola${contactName ? ` ${contactName}` : ''}!`,
    body1: (inviterName) => `<strong>${inviterName}</strong> te acaba de agregar a su red profesional en Warmly — un CRM personal para cultivar relaciones importantes.`,
    body2: 'Únete a Warmly para mantenerte conectado y nunca perder el contacto con las personas de tu red.',
    cta: 'Unirse a Warmly',
    iosApp: 'Descargar la app de iOS',
    footer: 'Warmly te ayuda a recordar a las personas importantes en tu vida profesional.',
  },
  fr: {
    subject: (inviterName) => `${inviterName} souhaite rester en contact avec vous sur Warmly`,
    greeting: (contactName) => `Bonjour${contactName ? ` ${contactName}` : ''} !`,
    body1: (inviterName) => `<strong>${inviterName}</strong> vient de vous ajouter à son réseau professionnel sur Warmly — un CRM personnel pour entretenir les relations qui comptent.`,
    body2: 'Rejoignez Warmly pour rester connecté et ne jamais perdre le contact avec les personnes de votre réseau.',
    cta: 'Rejoindre Warmly',
    iosApp: "Télécharger l'app iOS",
    footer: 'Warmly vous aide à vous souvenir des personnes importantes dans votre vie professionnelle.',
  },
  vi: {
    subject: (inviterName) => `${inviterName} muốn giữ liên lạc với bạn trên Warmly`,
    greeting: (contactName) => `Xin chào${contactName ? ` ${contactName}` : ''}!`,
    body1: (inviterName) => `<strong>${inviterName}</strong> vừa thêm bạn vào mạng lưới chuyên nghiệp của họ trên Warmly — một CRM cá nhân để nuôi dưỡng các mối quan hệ quan trọng.`,
    body2: 'Tham gia Warmly để giữ kết nối và không bao giờ mất liên lạc với những người trong mạng lưới của bạn.',
    cta: 'Tham gia Warmly',
    iosApp: 'Tải ứng dụng iOS',
    footer: 'Warmly giúp bạn nhớ những người quan trọng trong sự nghiệp của mình.',
  },
  th: {
    subject: (inviterName) => `${inviterName} ต้องการติดต่อกับคุณบน Warmly`,
    greeting: (contactName) => `สวัสดี${contactName ? ` ${contactName}` : ''}!`,
    body1: (inviterName) => `<strong>${inviterName}</strong> เพิ่งเพิ่มคุณเข้าสู่เครือข่ายมืออาชีพของพวกเขาบน Warmly — CRM ส่วนตัวสำหรับรักษาความสัมพันธ์ที่สำคัญ`,
    body2: 'เข้าร่วม Warmly เพื่อติดต่อกับคนสำคัญในเครือข่ายของคุณอยู่เสมอ',
    cta: 'เข้าร่วม Warmly',
    iosApp: 'ดาวน์โหลดแอป iOS',
    footer: 'Warmly ช่วยให้คุณจดจำคนสำคัญในชีวิตการทำงานของคุณ',
  },
}

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

export async function sendContactInviteEmail(
  to: string,
  contactName: string,
  inviterName: string,
  locale: string = 'en'
): Promise<void> {
  const from = process.env.SMTP_FROM || 'Warmly <noreply@mywarmly.app>'
  const signupUrl = FRONTEND_URL
  const iosAppUrl = 'https://apps.apple.com/us/app/mywarmly/id6757930392'

  // Get translations for the locale, fallback to English
  const t = contactInviteTranslations[locale] || contactInviteTranslations['en']

  await transporter.sendMail({
    from,
    to,
    subject: t.subject(inviterName),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #39E079; margin: 0; font-size: 28px;">Warmly</h1>
        </div>
        <h2 style="color: #333; font-size: 20px; margin-bottom: 16px;">${t.greeting(contactName)}</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          ${t.body1(inviterName)}
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          ${t.body2}
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${signupUrl}" style="background: #39E079; color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            ${t.cta}
          </a>
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <a href="${iosAppUrl}" style="color: #39E079; font-size: 14px; text-decoration: none;">
            📱 ${t.iosApp}
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #999; font-size: 13px; line-height: 1.5; text-align: center;">
          ${t.footer}
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
