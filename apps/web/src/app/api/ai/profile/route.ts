import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const tenantAiProfileSchema = z.object({
  companyName: z.string().max(200).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  industryTemplateId: z.string().nullable().optional(),
  companyDescription: z.string().max(5000).nullable().optional(),
  servicesOffered: z.string().max(5000).nullable().optional(),
  targetAudience: z.string().max(5000).nullable().optional(),
  companyValues: z.string().max(5000).nullable().optional(),
  toneOfVoiceOverride: z.string().max(5000).nullable().optional(),
  faqContent: z.string().max(20000).nullable().optional(),
  openingHours: z.string().max(1000).nullable().optional(),
  geographicArea: z.string().max(1000).nullable().optional(),
  leadQualificationGoals: z.string().max(5000).nullable().optional(),
  qualificationQuestions: z.unknown().optional(),
  disallowedTopics: z.string().max(5000).nullable().optional(),
  escalationInstructions: z.string().max(5000).nullable().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.tenantAIProfile.findFirst({
    where: { tenantId: session.user.tenantId },
  });

  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = tenantAiProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const profile = await prisma.tenantAIProfile.upsert({
      where: { tenantId: session.user.tenantId },
      create: {
        tenantId: session.user.tenantId,
        companyName: data.companyName ?? null,
        industry: data.industry ?? null,
        companyDescription: data.companyDescription ?? null,
        servicesOffered: data.servicesOffered ?? null,
        targetAudience: data.targetAudience ?? null,
        companyValues: data.companyValues ?? null,
        toneOfVoiceOverride: data.toneOfVoiceOverride ?? null,
        faqContent: data.faqContent ?? null,
        openingHours: data.openingHours ?? null,
        geographicArea: data.geographicArea ?? null,
        leadQualificationGoals: data.leadQualificationGoals ?? null,
        qualificationQuestions: data.qualificationQuestions ?? undefined,
        disallowedTopics: data.disallowedTopics ?? null,
        escalationInstructions: data.escalationInstructions ?? null,
        industryTemplateId: data.industryTemplateId ?? null,
      },
      update: {
        companyName: data.companyName ?? null,
        industry: data.industry ?? null,
        companyDescription: data.companyDescription ?? null,
        servicesOffered: data.servicesOffered ?? null,
        targetAudience: data.targetAudience ?? null,
        companyValues: data.companyValues ?? null,
        toneOfVoiceOverride: data.toneOfVoiceOverride ?? null,
        faqContent: data.faqContent ?? null,
        openingHours: data.openingHours ?? null,
        geographicArea: data.geographicArea ?? null,
        leadQualificationGoals: data.leadQualificationGoals ?? null,
        qualificationQuestions: data.qualificationQuestions ?? undefined,
        disallowedTopics: data.disallowedTopics ?? null,
        escalationInstructions: data.escalationInstructions ?? null,
        industryTemplateId: data.industryTemplateId ?? null,
      },
    });

    return NextResponse.json(profile);
  } catch (e) {
    console.error("[ai] failed to upsert tenant AI profile", e);
    return NextResponse.json({ error: "Failed to save AI profile" }, { status: 500 });
  }
}

