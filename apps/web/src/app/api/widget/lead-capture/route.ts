import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadCaptureSchema } from "@leadbot/shared";
import { checkRateLimit } from "@/lib/rate-limit";
import { addCrmJob } from "@/lib/queue";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = leadCaptureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { sessionId, name, email, phone, company, message } = parsed.data;

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { site: true },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (!checkRateLimit(session.siteId, session.visitorId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const hasContact = !!(email?.trim() || phone?.trim());
  if (!hasContact) {
    return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
  }

  const logCtx = { sessionId, siteId: session.siteId, tenantId: session.site.tenantId };
  const existingLead = await prisma.lead.findUnique({ where: { sessionId } });
  if (existingLead) {
    console.info("[lead] lead-capture: lead already exists", { ...logCtx, leadId: existingLead.id });
    return NextResponse.json({ ok: true, leadId: existingLead.id });
  }

  const score = 50; // default for offline capture
  let lead: { id: string };
  try {
    lead = await prisma.lead.create({
      data: {
        sessionId,
        siteId: session.siteId,
        name: name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        company: company ?? null,
        notes: message ?? null,
        score,
        qualified: true,
        crmProvider: "NONE",
      },
    });
    console.info("[lead] lead-capture: created in database", { ...logCtx, leadId: lead.id });
  } catch (e) {
    console.error("[lead] lead-capture: create failed", logCtx, e);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: "QUALIFIED" },
  });

  const tenantId = session.site.tenantId;
  const webhookConn = await prisma.crmConnection.findUnique({
    where: { tenantId_provider: { tenantId, provider: "WEBHOOK" } },
  });
  if (webhookConn?.webhookUrl) {
    try {
      await addCrmJob({ leadId: lead.id, tenantId, provider: "WEBHOOK" });
    } catch (e) {
      console.error("[lead] lead-capture: Enqueue webhook job failed", { ...logCtx, leadId: lead.id }, e);
    }
  }
  const hubspotConn = await prisma.crmConnection.findUnique({
    where: { tenantId_provider: { tenantId, provider: "HUBSPOT" } },
  });
  if (hubspotConn?.hubspotAccessToken) {
    try {
      await addCrmJob({ leadId: lead.id, tenantId, provider: "HUBSPOT" });
    } catch (e) {
      console.error("[lead] lead-capture: Enqueue HubSpot job failed", { ...logCtx, leadId: lead.id }, e);
    }
  }
  try {
    const { runWorkflowsForLead } = await import("@/lib/workflows");
    await runWorkflowsForLead(lead.id, tenantId, "LEAD_CAPTURED");
  } catch (e) {
    console.error("[lead] lead-capture: Workflows failed", { ...logCtx, leadId: lead.id }, e);
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
