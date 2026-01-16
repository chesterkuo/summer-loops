import jsQR from 'jsqr';

export interface QRContactData {
  type: 'line' | 'telegram' | 'whatsapp' | 'wechat' | 'unknown';
  username?: string;
  phone?: string;
  displayName?: string;
  rawUrl: string;
}

export interface ParsedQRContact {
  name: string;
  phone?: string;
  notes: string;
  social: {
    line?: string;
    telegram?: string;
    whatsapp?: string;
    wechat?: string;
  };
  source: 'qr_code';
}

/**
 * Decode QR code from an image
 * @param imageData - base64 image data or ImageData object
 * @returns decoded string or null if no QR code found
 */
export async function decodeQRFromImage(base64Image: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(null);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      resolve(code?.data || null);
    };

    img.onerror = () => {
      resolve(null);
    };

    // Handle both with and without data URL prefix
    if (base64Image.startsWith('data:')) {
      img.src = base64Image;
    } else {
      img.src = `data:image/jpeg;base64,${base64Image}`;
    }
  });
}

/**
 * Parse QR code URL to extract contact information
 */
export function parseQRCodeUrl(url: string): QRContactData | null {
  if (!url) return null;

  const lowerUrl = url.toLowerCase();

  // LINE QR codes
  // Formats:
  // - https://line.me/ti/p/~username
  // - https://line.me/ti/p/@username
  // - line://ti/p/~username
  // - https://line.me/R/ti/p/@username
  if (lowerUrl.includes('line.me') || lowerUrl.startsWith('line://')) {
    const patterns = [
      /line\.me\/ti\/p\/~([^\/\?]+)/i,
      /line\.me\/ti\/p\/@([^\/\?]+)/i,
      /line\.me\/ti\/p\/([^\/\?]+)/i,
      /line\.me\/R\/ti\/p\/@([^\/\?]+)/i,
      /line\.me\/R\/ti\/p\/([^\/\?]+)/i,
      /line:\/\/ti\/p\/~([^\/\?]+)/i,
      /line:\/\/ti\/p\/@([^\/\?]+)/i,
      /line:\/\/ti\/p\/([^\/\?]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          type: 'line',
          username: match[1],
          rawUrl: url,
        };
      }
    }
  }

  // Telegram QR codes
  // Formats:
  // - https://t.me/username
  // - https://telegram.me/username
  // - tg://resolve?domain=username
  if (lowerUrl.includes('t.me') || lowerUrl.includes('telegram.me') || lowerUrl.startsWith('tg://')) {
    const patterns = [
      /t\.me\/([^\/\?]+)/i,
      /telegram\.me\/([^\/\?]+)/i,
      /tg:\/\/resolve\?domain=([^&]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        // Filter out common Telegram bot/group prefixes
        const username = match[1];
        if (!['joinchat', 'addstickers', 'share'].includes(username.toLowerCase())) {
          return {
            type: 'telegram',
            username: username,
            rawUrl: url,
          };
        }
      }
    }
  }

  // WhatsApp QR codes
  // Formats:
  // - https://wa.me/886912345678
  // - https://api.whatsapp.com/send?phone=886912345678
  // - whatsapp://send?phone=886912345678
  if (lowerUrl.includes('wa.me') || lowerUrl.includes('whatsapp.com') || lowerUrl.startsWith('whatsapp://')) {
    const patterns = [
      /wa\.me\/(\d+)/i,
      /whatsapp\.com\/send\?phone=(\d+)/i,
      /whatsapp:\/\/send\?phone=(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          type: 'whatsapp',
          phone: '+' + match[1],
          rawUrl: url,
        };
      }
    }
  }

  // WeChat QR codes
  // Formats:
  // - weixin://dl/chat?username
  // - weixin://dl/business/?t=xxxxx (business card)
  // - https://u.wechat.com/xxxxx
  if (lowerUrl.includes('weixin://') || lowerUrl.includes('wechat.com')) {
    const patterns = [
      /weixin:\/\/dl\/chat\?([^&]+)/i,
      /weixin:\/\/dl\/business\/\?t=([^&]+)/i,
      /u\.wechat\.com\/([^\/\?]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          type: 'wechat',
          username: match[1],
          rawUrl: url,
        };
      }
    }
  }

  // Unknown QR code with URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      type: 'unknown',
      rawUrl: url,
    };
  }

  return null;
}

/**
 * Convert QR contact data to contact form data
 */
export function qrContactToFormData(qrData: QRContactData): ParsedQRContact {
  const social: ParsedQRContact['social'] = {};
  let name = '';
  let phone = '';
  let notes = '';

  switch (qrData.type) {
    case 'line':
      social.line = qrData.username;
      name = qrData.username || '';
      notes = `LINE ID: ${qrData.username}\nAdded via QR code scan`;
      break;

    case 'telegram':
      social.telegram = qrData.username;
      name = qrData.username || '';
      notes = `Telegram: @${qrData.username}\nAdded via QR code scan`;
      break;

    case 'whatsapp':
      social.whatsapp = qrData.phone;
      phone = qrData.phone || '';
      name = ''; // User needs to fill in
      notes = `WhatsApp: ${qrData.phone}\nAdded via QR code scan`;
      break;

    case 'wechat':
      social.wechat = qrData.username;
      name = qrData.username || '';
      notes = `WeChat ID: ${qrData.username}\nAdded via QR code scan`;
      break;

    default:
      notes = `QR Code URL: ${qrData.rawUrl}\nAdded via QR code scan`;
  }

  return {
    name,
    phone,
    notes,
    social,
    source: 'qr_code',
  };
}

/**
 * Get display name for QR code type
 */
export function getQRTypeDisplayName(type: QRContactData['type']): string {
  const names: Record<QRContactData['type'], string> = {
    line: 'LINE',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    wechat: 'WeChat',
    unknown: 'QR Code',
  };
  return names[type] || 'QR Code';
}

/**
 * Get icon name for QR code type (Material Icons)
 */
export function getQRTypeIcon(type: QRContactData['type']): string {
  const icons: Record<QRContactData['type'], string> = {
    line: 'chat',
    telegram: 'send',
    whatsapp: 'phone_iphone',
    wechat: 'forum',
    unknown: 'qr_code',
  };
  return icons[type] || 'qr_code';
}
