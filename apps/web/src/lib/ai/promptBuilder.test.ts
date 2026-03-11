import { describe, it, expect } from "vitest";
import { buildSystemPromptFromInputs, type PromptMode } from "./promptBuilder";

const baseInputs = {
  tenant: { id: "t1", name: "Tenant One" },
  site: { id: "s1", domain: "tenant-one.example.com" } as any,
  widgetConfig: {
    greetingText: "Hi from Tenant One",
    offlineMessage: "We're offline",
    qualificationQuestions: [],
    leadThreshold: 60,
    toneOfVoice: "Friendly and concise.",
    collectEmailPhoneFirst: true,
  } as any,
  aiProfile: null,
  industryTemplate: null,
  mode: "lead" as PromptMode,
  outsideBusinessHours: false,
};

describe("buildSystemPromptFromInputs", () => {
  it("produces different prompts for different tenants", () => {
    const promptA = buildSystemPromptFromInputs(baseInputs);
    const promptB = buildSystemPromptFromInputs({
      ...baseInputs,
      tenant: { id: "t2", name: "Tenant Two" },
      site: { id: "s2", domain: "tenant-two.example.com" } as any,
      widgetConfig: {
        ...baseInputs.widgetConfig,
        greetingText: "Hello from Tenant Two",
      } as any,
    });

    expect(promptA).not.toEqual(promptB);
    expect(promptA).toContain("Tenant One");
    expect(promptB).toContain("Tenant Two");
    expect(promptA).toContain("Hi from Tenant One");
    expect(promptB).toContain("Hello from Tenant Two");
  });

  it("falls back gracefully when tenant profile is missing", () => {
    const prompt = buildSystemPromptFromInputs(baseInputs);
    expect(prompt).toContain("Tenant One");
    expect(prompt).toContain("Hi from Tenant One");
    // No crash and still contains safety instructions
    expect(prompt.toLowerCase()).toContain("do not provide harmful");
  });

  it("incorporates industry template and tenant profile", () => {
    const prompt = buildSystemPromptFromInputs({
      ...baseInputs,
      aiProfile: {
        id: "p1",
        tenantId: "t1",
        companyName: "CarCo",
        industry: "car_dealership",
        companyDescription: "We sell new and used cars.",
        servicesOffered: "New cars, used cars, financing.",
        targetAudience: "People looking for a car.",
        companyValues: "Honesty and transparency.",
        toneOfVoiceOverride: "Upbeat and sales-driven.",
        faqContent: null,
        openingHours: null,
        geographicArea: "Local city",
        leadQualificationGoals: "Find serious car buyers with budget and timeline.",
        qualificationQuestions: [
          { id: "q1", question: "Are you interested in a new or used car?", required: true },
        ],
        disallowedTopics: "No legal or tax advice.",
        escalationInstructions: "If they want to sign a contract, escalate to sales.",
        createdAt: new Date(),
        updatedAt: new Date(),
        industryTemplateId: null,
      } as any,
      industryTemplate: {
        id: "tmpl1",
        industryKey: "car_dealership",
        name: "Car dealership",
        baseIndustryPrompt: "You help visitors choose the right car.",
        suggestedQuestions: [
          { question: "What budget range are you considering?", whenToAsk: "mid" },
        ],
        qualificationLogic: "Good leads have clear model preferences and a 0-3 month timeline.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(prompt).toContain("CarCo");
    expect(prompt).toContain("car_dealership");
    expect(prompt).toContain("You help visitors choose the right car.");
    expect(prompt).toContain("Are you interested in a new or used car?");
    expect(prompt).toContain("What budget range are you considering?");
  });
});

