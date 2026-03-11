import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant-1" },
    update: {},
    create: {
      id: "demo-tenant-1",
      name: "Demo Company",
    },
  });

  const passwordHash = await hash("demo1234", 12);
  await prisma.user.upsert({
    where: { id: "demo-user-1" },
    update: {},
    create: {
      id: "demo-user-1",
      tenantId: tenant.id,
      email: "admin@democompany.com",
      passwordHash,
      role: "owner",
    },
  });

  const site = await prisma.site.upsert({
    where: { tenantId_domain: { tenantId: tenant.id, domain: "demo.example.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      domain: "demo.example.com",
    },
  });

  await prisma.widgetConfig.upsert({
    where: { siteId: site.id },
    update: {},
    create: {
      siteId: site.id,
      botName: "LeadBot",
      primaryColor: "#2563eb",
      greetingText: "Hi! How can I help you today?",
      offlineMessage: "We're offline. Leave your details and we'll get back to you.",
      qualificationQuestions: [
        { id: "q1", question: "What brings you here today?", required: true },
        { id: "q2", question: "What's your timeline?", required: false },
      ],
      leadThreshold: 60,
      businessHoursStart: 8,
      businessHoursEnd: 16,
      collectEmailPhoneFirst: true,
    },
  });

  // Seed industry prompt templates
  const carDealerTemplate = await prisma.industryPromptTemplate.upsert({
    where: { industryKey: "car_dealership" },
    update: {},
    create: {
      industryKey: "car_dealership",
      name: "Car dealership",
      baseIndustryPrompt:
        "You are the digital sales assistant for a car dealership. You help visitors find the right car, explain options, and encourage test drives or calls with sales. Focus on understanding their needs (new/used, model type, budget, financing, trade-in) and guiding them to the next step with the dealership.",
      suggestedQuestions: [
        { question: "Are you looking for a new or used car?", whenToAsk: "early" },
        { question: "Do you have a preferred brand or model?", whenToAsk: "early" },
        { question: "What budget range are you considering?", whenToAsk: "mid" },
        { question: "When are you hoping to make a decision?", whenToAsk: "mid" },
        { question: "Are you interested in financing or leasing options?", whenToAsk: "late" },
        { question: "Do you have a car you might want to trade in?", whenToAsk: "late" },
      ],
      qualificationLogic:
        "Prioritize visitors who have a clear car type in mind, a realistic budget, and a decision timeline within 0–3 months. Strong buying signals: mentions of specific models, asking about availability, or requesting test drives.",
    },
  });

  const constructionTemplate = await prisma.industryPromptTemplate.upsert({
    where: { industryKey: "construction_trades" },
    update: {},
    create: {
      industryKey: "construction_trades",
      name: "Construction / trades",
      baseIndustryPrompt:
        "You are the digital project coordinator for a construction or trades company (e.g. contractors, electricians, plumbers). You help visitors describe their project, check fit, and collect enough details for a professional follow-up.",
      suggestedQuestions: [
        { question: "Can you briefly describe your project?", whenToAsk: "early" },
        { question: "Where is the project located?", whenToAsk: "early" },
        { question: "When would you like the work to start?", whenToAsk: "mid" },
        { question: "Do you have an approximate budget range?", whenToAsk: "mid" },
        { question: "Have you worked with contractors on similar projects before?", whenToAsk: "late" },
      ],
      qualificationLogic:
        "Qualify strongly when the project is within the geographic area, the scope matches offered services, and the requested start is within 0–3 months. Key signals: clear project description, location, budget range, and readiness to get a quote or site visit.",
    },
  });

  const clinicTemplate = await prisma.industryPromptTemplate.upsert({
    where: { industryKey: "clinic" },
    update: {},
    create: {
      industryKey: "clinic",
      name: "Clinic / healthcare",
      baseIndustryPrompt:
        "You are a digital assistant for a clinic. You provide friendly, safe, non-diagnostic information, help visitors understand services, and guide them to book appointments or request contact. Always stay within informational and administrative guidance; do not give medical diagnoses or treatment decisions.",
      suggestedQuestions: [
        { question: "What kind of help are you looking for today?", whenToAsk: "early" },
        { question: "Have you been to this clinic before?", whenToAsk: "mid" },
        { question: "Do you have any preferences for time or practitioner?", whenToAsk: "mid" },
        { question: "Is there anything important the team should know before the appointment?", whenToAsk: "late" },
      ],
      qualificationLogic:
        "A strong lead is someone clearly interested in booking or changing an appointment, asking about specific treatments the clinic offers, or requesting a call-back. Never attempt to triage emergencies; always escalate urgent or serious symptoms to call emergency services or a doctor directly.",
    },
  });

  // Link demo tenant to car dealership template as default AI profile
  await prisma.tenantAIProfile.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      companyName: "Demo Motors",
      industry: "car_dealership",
      companyDescription:
        "Demo Motors is a car dealership offering a range of new and used vehicles with financing and trade-in options.",
      servicesOffered:
        "New car sales, used car sales, trade-ins, financing and leasing options, test drives, after-sales support.",
      targetAudience:
        "Car buyers in the local area looking for a trustworthy dealership for new or used vehicles.",
      companyValues:
        "Honesty, transparency, and helping customers find the right car for their needs and budget.",
      toneOfVoiceOverride:
        "Friendly, professional, and down-to-earth. Avoid jargon. Focus on clear, practical advice.",
      geographicArea: "Local region around the dealership city and nearby towns.",
      leadQualificationGoals:
        "Identify serious buyers, understand what kind of car they want, when they want to buy, and whether they need financing or have a trade-in.",
      qualificationQuestions: [
        { id: "ai-q1", question: "Are you mainly interested in a new or used car?", required: true },
        { id: "ai-q2", question: "Do you have a preferred brand or model?", required: false },
        { id: "ai-q3", question: "Roughly what budget range are you considering?", required: false },
      ],
      disallowedTopics:
        "Do not provide financial, legal, or insurance advice beyond explaining the dealership's own offerings.",
      escalationInstructions:
        "If the visitor requests a test drive, detailed financing explanation, or wants to discuss a specific vehicle, collect their contact details and ask when they are available. Then clearly note this in the summary so the sales team can call or email.",
      industryTemplateId: carDealerTemplate.id,
    },
  });

  console.log("Seed complete. Demo tenant:", tenant.id, "Site ID (use for widget):", site.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
