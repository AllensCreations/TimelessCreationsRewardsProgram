import { renderOtpTemplate } from './mailer.js';

export function generateOtpHtml({ name, otpCode, displayDate } = {}) {
  return renderOtpTemplate({ name, otpCode, displayDate });
}
