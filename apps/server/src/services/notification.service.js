const axios = require('axios');
const { env } = require('../config/env');

/**
 * Sends email via Resend API.
 */
async function sendEmail({ to, subject, text, html }) {
  if (!env.RESEND_API_KEY) {
    console.log('[Email] Resend API key not configured, skipping email to', to);
    return;
  }

  try {
    await axios.post(
      'https://api.resend.com/emails',
      { from: 'Vaultify <noreply@vaultify.dev>', to, subject, text, html },
      { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } }
    );
    console.log('[Email] Sent to', to);
  } catch (err) {
    console.error('[Email] Failed to send:', err.message);
  }
}

/**
 * Sends Slack webhook notification.
 */
async function sendSlackNotification(message) {
  if (!env.SLACK_WEBHOOK_URL) {
    console.log('[Slack] Webhook URL not configured, skipping notification');
    return;
  }

  try {
    await axios.post(env.SLACK_WEBHOOK_URL, {
      text: message,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: message },
        },
      ],
    });
    console.log('[Slack] Notification sent');
  } catch (err) {
    console.error('[Slack] Failed to send:', err.message);
  }
}

/**
 * Notify workspace owner of new access request.
 */
async function notifyAccessRequest(ownerEmail, requesterName, provider, environment) {
  const subject = `Vaultify: New access request from ${requesterName}`;
  const text = `${requesterName} has requested access to ${provider} (${environment} environment). Review at: ${env.APP_URL || 'your Vaultify dashboard'}`;
  await sendEmail({ to: ownerEmail, subject, text });
  await sendSlackNotification(`🔐 *New Access Request*\n• Requester: ${requesterName}\n• Provider: ${provider}\n• Environment: ${environment}`);
}

/**
 * Notify requester of request approval/denial.
 */
async function notifyRequestDecision(requesterEmail, status, provider, tokenString = null) {
  const subject = `Vaultify: Access request ${status}`;
  let text = `Your access request for ${provider} has been ${status}.`;
  if (status === 'approved' && tokenString) {
    text += `\n\nYour proxy token: ${tokenString}`;
  }
  await sendEmail({ to: requesterEmail, subject, text });
}

module.exports = {
  sendEmail,
  sendSlackNotification,
  notifyAccessRequest,
  notifyRequestDecision,
};
