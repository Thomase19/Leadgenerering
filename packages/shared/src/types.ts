export type QualificationState = {
  intent?: string;
  urgency?: string;
  budgetSignal?: string;
  serviceType?: string;
  serviceInterest?: string;
  timeline?: string;
  contactCaptured?: boolean;
  companySizeSignal?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  contactCompany?: string;
  location?: string;
  notes?: string;
};

export type QualificationQuestion = {
  id: string;
  question: string;
  required: boolean;
};

export type WidgetConfigPublic = {
  botName: string;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  primaryColor: string;
  greetingText: string;
  offlineMessage: string;
  qualificationQuestions: QualificationQuestion[];
  leadThreshold: number;
  businessHoursStart: number | null;
  businessHoursEnd: number | null;
  collectEmailPhoneFirst: boolean;
  toneOfVoice: string | null;
  inputPlaceholder: string | null;
  typingText: string | null;
  sendButtonLabel: string | null;
  isWithinBusinessHours: boolean;
};

export type WebhookPayload = {
  leadId: string;
  siteDomain: string;
  capturedAt: string; // ISO
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    notes?: string;
  };
  score: number;
  summary: string | null;
  transcriptUrl: string;
};
