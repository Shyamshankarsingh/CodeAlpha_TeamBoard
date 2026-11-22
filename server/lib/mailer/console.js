import { logger } from '../../logger.js';
import { config } from '../../config.js';

const sentEmails = [];

export const mailer = {
  async sendEmail({ to, subject, text, html }) {
    const emailEntry = {
      to,
      subject,
      text,
      html,
      sentAt: new Date().toISOString(),
    };

    sentEmails.push(emailEntry);

    logger.info(`[MAILER] Email sent to ${to}: ${subject}`, {
      to,
      subject,
      snippet: text ? text.substring(0, 100) : '',
    });

    if (config.NODE_ENV !== 'test') {
      console.log('\n--- EMAIL SENT ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text:\n${text}`);
      console.log('------------------\n');
    }

    return true;
  },

  getSentEmails() {
    return [...sentEmails];
  },

  clearSentEmails() {
    sentEmails.length = 0;
  },
};
