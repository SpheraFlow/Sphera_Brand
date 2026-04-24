export const EVENT_TYPES = {
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  AI_REPLY_GENERATED: 'ai.reply_generated',
  AI_REPLY_SENT: 'ai.reply_sent',
  HANDOFF_STARTED: 'handoff.started',
  HANDOFF_ASSIGNED: 'handoff.assigned',
  HANDOFF_RESOLVED: 'handoff.resolved',
  HANDOFF_ENDED: 'handoff.ended',
  BOT_REACTIVATED: 'bot.reactivated',
  LEAD_CREATED: 'lead.created',
  LEAD_STAGE_CHANGED: 'lead.stage_changed',
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_NO_SHOW: 'appointment.no_show',
  PERSON_CREATED: 'person.created',
  PERSON_IDENTITY_ADDED: 'person.identity_added',
  POLICY_BLOCKED: 'policy.blocked',
  ERROR_OCCURRED: 'error.occurred',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
