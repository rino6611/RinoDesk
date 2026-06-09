export async function sendSlackAlert(webhookUrl: string, ticket: {
  id: number;
  subject: string;
  customerName: string;
  customerEmail: string;
  priority: string;
  escalationRisk: string | null;
  escalationReason: string | null;
}) {
  const riskEmoji = ticket.escalationRisk === "high" ? "🔴" : "🟡";
  const payload = {
    text: `${riskEmoji} *Escalation Alert* — Ticket #${ticket.id}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${riskEmoji} Escalation Alert — Ticket #${ticket.id}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Subject:*\n${ticket.subject}` },
          { type: "mrkdwn", text: `*Customer:*\n${ticket.customerName} (${ticket.customerEmail})` },
          { type: "mrkdwn", text: `*Priority:*\n${ticket.priority.toUpperCase()}` },
          { type: "mrkdwn", text: `*Risk Level:*\n${(ticket.escalationRisk ?? "unknown").toUpperCase()}` },
        ],
      },
      ...(ticket.escalationReason
        ? [{
            type: "section",
            text: { type: "mrkdwn", text: `*Reason:*\n${ticket.escalationReason}` },
          }]
        : []),
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Detected by RinoDesk AgentOS EscalationDetector at <!date^${Math.floor(Date.now() / 1000)}^{time}|${new Date().toISOString()}>` },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}: ${await res.text()}`);
  }
}
