/**
 * Notification Rules Engine
 *
 * Defines when and how notifications should be triggered
 */

export type NotificationChannel = 'email' | 'telegram';
export type NotificationPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface NotificationRule {
  name: string;
  description: string;
  condition: (data: any) => boolean;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  throttle?: number; // Minutes to wait before sending again
}

/**
 * Churn risk thresholds
 */
export const CHURN_THRESHOLDS = {
  CRITICAL: 85,
  HIGH: 70,
  MEDIUM: 50,
  LOW: 30,
} as const;

/**
 * Notification rules
 */
export const NOTIFICATION_RULES: Record<string, NotificationRule> = {
  CHURN_CRITICAL: {
    name: 'Churn Critical',
    description: 'Customer has critical churn risk (>=85)',
    condition: (avatar) => avatar.churn_risk_score >= CHURN_THRESHOLDS.CRITICAL,
    channels: ['email', 'telegram'],
    priority: 'urgent',
    throttle: 1440, // Once per day max
  },

  CHURN_HIGH: {
    name: 'Churn High',
    description: 'Customer has high churn risk (>=70)',
    condition: (avatar) =>
      avatar.churn_risk_score >= CHURN_THRESHOLDS.HIGH &&
      avatar.churn_risk_score < CHURN_THRESHOLDS.CRITICAL,
    channels: ['email'],
    priority: 'high',
    throttle: 2880, // Once every 2 days max
  },

  ORDER_OVERDUE_CRITICAL: {
    name: 'Order Overdue Critical',
    description: 'No order in >90 days from regular customer',
    condition: (avatar) =>
      avatar.days_since_last_order > 90 &&
      avatar.total_revenue > 10000,
    channels: ['email', 'telegram'],
    priority: 'urgent',
    throttle: 10080, // Once per week
  },

  ORDER_OVERDUE_HIGH: {
    name: 'Order Overdue High',
    description: 'No order in >60 days',
    condition: (avatar) =>
      avatar.days_since_last_order > 60 &&
      avatar.days_since_last_order <= 90,
    channels: ['email'],
    priority: 'high',
    throttle: 10080, // Once per week
  },

  REVENUE_DROP: {
    name: 'Revenue Drop',
    description: 'Revenue dropped >50% compared to average',
    condition: (avatar) =>
      avatar.revenue_trend === 'declining' &&
      avatar.total_revenue > 5000,
    channels: ['email'],
    priority: 'medium',
    throttle: 20160, // Once every 2 weeks
  },

  VISIT_OVERDUE: {
    name: 'Visit Overdue',
    description: 'Visit planned but not completed',
    condition: (visit) =>
      visit.status === 'pending' &&
      new Date(visit.scheduled_date) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    channels: ['email'],
    priority: 'medium',
    throttle: 1440, // Once per day
  },
};

/**
 * Daily summary schedule
 */
export const DAILY_SUMMARY_SCHEDULE = {
  enabled: true,
  time: '08:00', // 8 AM
  timezone: 'Europe/Zurich',
  channels: ['email'] as NotificationChannel[],
};

/**
 * Check if a notification should be sent based on rules
 */
export function shouldNotify(
  ruleName: keyof typeof NOTIFICATION_RULES,
  data: any,
  userPreferences?: {
    enabled: boolean;
    churnThreshold?: number;
    channels?: NotificationChannel[];
  }
): boolean {
  const rule = NOTIFICATION_RULES[ruleName];
  if (!rule) return false;

  // Check user preferences
  if (userPreferences && !userPreferences.enabled) {
    return false;
  }

  // Check custom churn threshold if applicable
  if (ruleName.startsWith('CHURN_') && userPreferences?.churnThreshold) {
    const hasChurnRisk = data.churn_risk_score >= userPreferences.churnThreshold;
    return hasChurnRisk && rule.condition(data);
  }

  // Check rule condition
  return rule.condition(data);
}

/**
 * Get notification channels for a rule
 */
export function getNotificationChannels(
  ruleName: keyof typeof NOTIFICATION_RULES,
  userPreferences?: {
    emailEnabled?: boolean;
    telegramEnabled?: boolean;
    channels?: NotificationChannel[];
  }
): NotificationChannel[] {
  const rule = NOTIFICATION_RULES[ruleName];
  if (!rule) return [];

  let channels = [...rule.channels];

  // Filter based on user preferences
  if (userPreferences) {
    if (userPreferences.channels) {
      channels = channels.filter(ch => userPreferences.channels!.includes(ch));
    } else {
      if (userPreferences.emailEnabled === false) {
        channels = channels.filter(ch => ch !== 'email');
      }
      if (userPreferences.telegramEnabled === false) {
        channels = channels.filter(ch => ch !== 'telegram');
      }
    }
  }

  return channels;
}

/**
 * Get notification priority
 */
export function getNotificationPriority(
  ruleName: keyof typeof NOTIFICATION_RULES
): NotificationPriority {
  const rule = NOTIFICATION_RULES[ruleName];
  return rule?.priority || 'medium';
}

/**
 * Check if notification was sent recently (throttling)
 */
export function shouldThrottle(
  ruleName: keyof typeof NOTIFICATION_RULES,
  lastSentAt: Date | null
): boolean {
  const rule = NOTIFICATION_RULES[ruleName];
  if (!rule || !rule.throttle || !lastSentAt) {
    return false;
  }

  const throttleMs = rule.throttle * 60 * 1000; // Convert minutes to ms
  const timeSinceLastSent = Date.now() - lastSentAt.getTime();

  return timeSinceLastSent < throttleMs;
}

/**
 * Get all applicable rules for a customer avatar
 */
export function getApplicableRules(
  avatar: any,
  userPreferences?: any
): Array<keyof typeof NOTIFICATION_RULES> {
  const applicableRules: Array<keyof typeof NOTIFICATION_RULES> = [];

  for (const [ruleName, rule] of Object.entries(NOTIFICATION_RULES)) {
    if (shouldNotify(ruleName as keyof typeof NOTIFICATION_RULES, avatar, userPreferences)) {
      applicableRules.push(ruleName as keyof typeof NOTIFICATION_RULES);
    }
  }

  // Sort by priority (urgent first)
  const priorityOrder: Record<NotificationPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  applicableRules.sort((a, b) => {
    const priorityA = priorityOrder[NOTIFICATION_RULES[a].priority];
    const priorityB = priorityOrder[NOTIFICATION_RULES[b].priority];
    return priorityA - priorityB;
  });

  return applicableRules;
}

/**
 * Get notification message template
 */
export function getNotificationMessage(
  ruleName: keyof typeof NOTIFICATION_RULES,
  data: any
): string {
  const rule = NOTIFICATION_RULES[ruleName];
  if (!rule) return '';

  // Return description as default message
  // Can be expanded with specific templates per rule
  return rule.description;
}
