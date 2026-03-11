import { prisma } from "@/lib/prisma";
import type { TenantAIProfile, IndustryPromptTemplate, WidgetConfig, Site } from "@prisma/client";

export type PromptMode = "support" | "lead" | "offline" | "booking";

type BuildInputs = {
  tenant: { id: string; name: string };
  site: Pick<Site, "id" | "domain">;
  widgetConfig: Pick<
    WidgetConfig,
    | "greetingText"
    | "offlineMessage"
    | "qualificationQuestions"
    | "leadThreshold"
    | "toneOfVoice"
    | "collectEmailPhoneFirst"
  >;
  aiProfile: TenantAIProfile | null;
  industryTemplate: IndustryPromptTemplate | null;
  mode: PromptMode;
  outsideBusinessHours: boolean;
};

export function buildSystemPromptFromInputs({
  tenant,
  site,
  widgetConfig,
  aiProfile,
  industryTemplate,
  mode,
  outsideBusinessHours,
}: BuildInputs): string {
  const parts: string[] = [];

  // Global base behavior
  parts.push(
    [
      "You are the AI assistant for this specific company. You ALWAYS represent this company, not a generic service.",
      "Your core goals:",
      "1) Help visitors with clear, correct, concise answers based on the company's services and FAQ.",
      "2) Qualify potential leads by understanding their intent, needs, and timeline.",
      "3) Capture enough details so the sales or service team can follow up effectively.",
      "",
      "Never invent services, locations, or capabilities that are not part of the company description.",
      "If you are unsure, say you are not sure and suggest contacting the team.",
    ].join(" ")
  );

  const companyName = aiProfile?.companyName?.trim() || tenant.name;
  const industryLabel = aiProfile?.industry?.trim() || industryTemplate?.name || "business";

  // Company + industry context
  parts.push(
    [
      `Company name: ${companyName}.`,
      `Industry: ${industryLabel}.`,
      aiProfile?.companyDescription
        ? `Company description: ${aiProfile.companyDescription}`
        : "The company provides services to its customers; focus on being helpful, sales-oriented, and honest.",
      aiProfile?.servicesOffered ? `Services offered: ${aiProfile.servicesOffered}` : "",
      aiProfile?.targetAudience ? `Target audience: ${aiProfile.targetAudience}` : "",
      aiProfile?.companyValues ? `Company values: ${aiProfile.companyValues}` : "",
      aiProfile?.geographicArea ? `Geographic focus/area: ${aiProfile.geographicArea}` : "",
      `Website domain: ${site.domain}.`,
    ]
      .filter(Boolean)
      .join(" ")
  );

  // Tone of voice
  const tone =
    aiProfile?.toneOfVoiceOverride?.trim() ||
    widgetConfig.toneOfVoice?.trim() ||
    "Professional, friendly, and concise. Use natural language and avoid jargon.";
  parts.push(`Tone of voice (follow strictly): ${tone}`);

  // Mode-specific instructions
  if (mode === "support") {
    parts.push(
      "Mode: Support & information. Focus on answering questions about the company, services, pricing ranges, and process. Offer clear next steps (e.g. contact, booking, or quote) when relevant."
    );
  } else if (mode === "booking") {
    parts.push(
      "Mode: Booking. Focus on helping the visitor move toward booking an appointment, call, or meeting, while staying within the company's process."
    );
  } else if (mode === "offline") {
    parts.push(
      "Mode: Offline capture. The team might not be available live. Focus on collecting the visitor's details and context so the team can follow up."
    );
  } else {
    parts.push(
      "Mode: Lead generation. Focus on understanding needs and turning interested visitors into qualified leads."
    );
  }

  // Widget greeting / offline message
  parts.push(`Default greeting context: ${widgetConfig.greetingText}`);
  if (outsideBusinessHours) {
    parts.push(
      "It is currently outside the company's normal opening hours. Set expectations that the team will follow up later, but still advise and qualify as usual. Collect contact details so the team can reach out."
    );
  }

  // Industry template behavior
  if (industryTemplate) {
    parts.push(
      `Industry-specific behavior:\n${industryTemplate.baseIndustryPrompt}`
    );
    if (industryTemplate.qualificationLogic) {
      parts.push(
        `Industry-specific qualification logic (what makes a good lead and typical buying signals):\n${industryTemplate.qualificationLogic}`
      );
    }
    if (industryTemplate.suggestedQuestions) {
      const sq = industryTemplate.suggestedQuestions as
        | { question: string; whenToAsk?: string }[]
        | null;
      if (sq && sq.length > 0) {
        parts.push(
          "Industry-specific questions to weave into the conversation when relevant:\n" +
            sq.map((q) => `- (${q.whenToAsk ?? "any time"}) ${q.question}`).join("\n")
        );
      }
    }
  }

  // Tenant-specific lead goals and qualification questions
  if (aiProfile?.leadQualificationGoals) {
    parts.push(`Lead qualification goals for this tenant: ${aiProfile.leadQualificationGoals}`);
  }

  const tenantQuestions =
    (aiProfile?.qualificationQuestions as
      | { id: string; question: string; required?: boolean }[]
      | null) ?? [];
  const widgetQuestions =
    (widgetConfig.qualificationQuestions as
      | { id: string; question: string; required: boolean }[]
      | null) ?? [];

  const mergedQuestions = [
    ...tenantQuestions,
    ...widgetQuestions.filter(
      (wq) => !tenantQuestions.some((tq) => tq.id === wq.id || tq.question === wq.question)
    ),
  ];

  if (mergedQuestions.length > 0) {
    parts.push(
      "Qualification questions to naturally weave into the conversation (adapt phrasing to context, do not ask as a rigid form):\n" +
        mergedQuestions.map((q) => `- ${q.question}${q.required ? " (important)" : ""}`).join("\n")
    );
  }

  // FAQ
  if (aiProfile?.faqContent?.trim()) {
    parts.push(
      "Company FAQ / reference info. Use this to answer common questions accurately and avoid hallucinations:\n" +
        aiProfile.faqContent.trim()
    );
  }

  // Safety, scope and disallowed topics
  parts.push(
    [
      "Stay strictly within the company's scope and services. If the user asks about something the company does not offer, say so and suggest the closest relevant service or that they contact support.",
      "Do NOT provide harmful, medical, legal, or financial advice. For anything risky or highly personal, encourage contacting a qualified professional at the company or appropriate authority.",
    ].join(" ")
  );

  if (aiProfile?.disallowedTopics?.trim()) {
    parts.push(
      "Additional topics you must avoid or handle with extreme care for this tenant:\n" +
        aiProfile.disallowedTopics.trim()
    );
  }

  if (aiProfile?.escalationInstructions?.trim()) {
    parts.push(
      "Escalation rules: In the following situations, stop giving detailed advice and instead escalate or suggest human contact:\n" +
        aiProfile.escalationInstructions.trim()
    );
  }

  // Lead qualification state model instructions
  parts.push(
    [
      "As you talk, you must gradually build a structured lead qualification state for the sales team.",
      "Aim to infer or ask about: intent, urgency, budgetSignal, serviceInterest, timeline, location, contactCaptured, companySizeSignal, notes.",
      "Only infer what is clearly implied; do not make up details.",
    ].join(" ")
  );

  // Lead capture and summary
  const threshold = widgetConfig.leadThreshold ?? 60;
  parts.push(
    [
      `Leads with a score at or above approximately ${threshold} are considered high-priority. When someone seems serious, politely ask for contact details (name, email, and optionally phone).`,
      "When the visitor is clearly interested, summarize their needs back to them and propose a clear next step (call, meeting, test drive, quote, booking, etc.).",
    ].join(" ")
  );

  if (widgetConfig.collectEmailPhoneFirst) {
    parts.push(
      "When engagement is high, prioritise collecting contact details early (name + email, phone if relevant) so the team can follow up even if the chat ends abruptly."
    );
  }

  // Final JSON block instruction for QualificationState
  parts.push(
    [
      "After each response, output a JSON block (on a single line, no markdown) with updated qualification state.",
      "Keys: intent, urgency, budgetSignal, serviceInterest, timeline, location, contactCaptured (true if they shared email or phone), companySizeSignal, contactEmail, contactPhone, contactName, contactCompany, notes.",
      "Only include keys that you can infer from the conversation. If you don't know something, omit that key.",
    ].join(" ")
  );

  return parts.filter(Boolean).join("\n\n");
}

export async function buildSystemPromptForTenant(params: {
  tenantId: string;
  siteId: string;
  mode: PromptMode;
  outsideBusinessHours: boolean;
}): Promise<string> {
  const { tenantId, siteId, mode, outsideBusinessHours } = params;

  const [tenant, site, widgetConfig, aiProfile] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.site.findUnique({ where: { id: siteId } }),
    prisma.widgetConfig.findUnique({ where: { siteId } }),
    prisma.tenantAIProfile.findUnique({ where: { tenantId } }),
  ]);

  if (!tenant || !site || !widgetConfig) {
    // Fallback generic prompt if data is missing
    const fallback = buildSystemPromptFromInputs({
      tenant: { id: tenantId, name: tenant?.name ?? "This Company" },
      site: {
        id: siteId,
        domain: site?.domain ?? "unknown",
      } as Site,
      widgetConfig: {
        greetingText: widgetConfig?.greetingText ?? "Hi! How can I help you today?",
        offlineMessage:
          widgetConfig?.offlineMessage ?? "We're offline. Leave your details and we'll get back to you.",
        qualificationQuestions:
          (widgetConfig?.qualificationQuestions as WidgetConfig["qualificationQuestions"]) ?? [],
        leadThreshold: widgetConfig?.leadThreshold ?? 60,
        toneOfVoice: widgetConfig?.toneOfVoice ?? null,
        collectEmailPhoneFirst: widgetConfig?.collectEmailPhoneFirst ?? true,
      } as WidgetConfig,
      aiProfile: aiProfile ?? null,
      industryTemplate: null,
      mode,
      outsideBusinessHours,
    });
    return fallback;
  }

  let industryTemplate: IndustryPromptTemplate | null = null;
  if (aiProfile?.industryTemplateId) {
    industryTemplate = await prisma.industryPromptTemplate.findUnique({
      where: { id: aiProfile.industryTemplateId },
    });
  } else if (aiProfile?.industry) {
    industryTemplate = await prisma.industryPromptTemplate.findUnique({
      where: { industryKey: aiProfile.industry },
    });
  }

  return buildSystemPromptFromInputs({
    tenant: { id: tenant.id, name: tenant.name },
    site,
    widgetConfig: {
      greetingText: widgetConfig.greetingText,
      offlineMessage: widgetConfig.offlineMessage,
      qualificationQuestions: widgetConfig.qualificationQuestions,
      leadThreshold: widgetConfig.leadThreshold,
      toneOfVoice: widgetConfig.toneOfVoice,
      collectEmailPhoneFirst: widgetConfig.collectEmailPhoneFirst,
    } as WidgetConfig,
    aiProfile,
    industryTemplate,
    mode,
    outsideBusinessHours,
  });
}

