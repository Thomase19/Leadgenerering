import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema } from "@leadbot/shared";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateResponse, generateSummary } from "@/lib/ai/provider";
import { getRelevantChunks } from "@/lib/ai/embeddings";
import { scoreLead, meetsThreshold } from "@leadbot/shared";
import type { QualificationState } from "@leadbot/shared";
import { addCrmJob } from "@/lib/queue";
import { buildSystemPromptForTenant } from "@/lib/ai/promptBuilder";

function mergeState(prev: QualificationState | null, next: QualificationState): QualificationState {
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("[lead] widget/message: invalid input", parsed.error.flatten());
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { sessionId, content } = parsed.data;
  console.info("[lead] widget/message: received", { sessionId, contentLength: content?.length });

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { site: { include: { widgetConfig: true, tenant: true } } },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (!session.site.widgetConfig) {
    return NextResponse.json({ error: "Widget not configured" }, { status: 400 });
  }

  if (!checkRateLimit(session.siteId, session.visitorId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  await prisma.chatMessage.create({
    data: { sessionId, role: "VISITOR", content },
  });

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  const chatMessages = messages.map((m) => ({
    role: m.role as "VISITOR" | "BOT",
    content: m.content,
  }));

  const config = session.site.widgetConfig;
  const questions = Array.isArray(config.qualificationQuestions)
    ? (config.qualificationQuestions as { id: string; question: string; required: boolean }[])
    : [];
  let kbChunks: string[] = [];
  try {
    const ragChunks = await getRelevantChunks(session.siteId, content, 5);
    if (ragChunks.length > 0) kbChunks = ragChunks;
  } catch {
    // RAG failed (e.g. no embeddings yet); use fallback
  }
  if (kbChunks.length === 0) {
    const kb = await prisma.knowledgeChunk.findMany({
      where: { siteId: session.siteId },
      take: 10,
    });
    kbChunks = kb.slice(0, 5).map((c) => c.content);
  }

  const outsideBusinessHours = !(config.businessHoursStart != null && config.businessHoursEnd != null)
    ? false
    : (() => {
        const h = new Date().getHours();
        const d = new Date().getDay();
        if (d === 0 || d === 6) return true;
        return h < (config.businessHoursStart ?? 0) || h >= (config.businessHoursEnd ?? 24);
      })();

  const recentSessions = await prisma.chatSession.findMany({
    where: { siteId: session.siteId, id: { not: sessionId } },
    orderBy: { startedAt: "desc" },
    take: 25,
    select: { summary: true, status: true, score: true },
  });
  const siteHistoryContext = recentSessions
    .filter((s) => s.summary || s.status !== "OPEN")
    .slice(0, 15)
    .map((s) => `- Outcome: ${s.status}, score ${s.score}. ${s.summary ? `Summary: ${s.summary.slice(0, 200)}${s.summary.length > 200 ? "…" : ""}` : ""}`)
    .join("\n");

  const currentState = (session.qualificationState as QualificationState | null) ?? undefined;

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPromptForTenant({
      tenantId: session.site.tenantId,
      siteId: session.siteId,
      mode: "lead",
      outsideBusinessHours,
    });
  } catch (e) {
    console.error("[ai] failed to build system prompt, falling back to generic prompt", e);
    systemPrompt =
      "You are a helpful sales and support assistant for this website. Answer questions clearly and honestly, " +
      "help visitors understand the services, and collect their contact details when they seem interested so the team can follow up. " +
      "Do not claim the company offers anything you are not sure about.";
  }

  let aiResult: { content: string; qualificationState: QualificationState };
  try {
    aiResult = await generateResponse({
      systemPrompt,
      messages: chatMessages,
      kbChunks,
      currentState: currentState ?? null,
      siteHistoryContext: siteHistoryContext || "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI error:", message, err);
    aiResult = {
      content: "Sorry, I'm having trouble right now. Please try again in a moment.",
      qualificationState: currentState ?? {},
    };
  }

  const mergedState = mergeState(currentState ?? null, aiResult.qualificationState);

  await prisma.chatMessage.create({
    data: { sessionId, role: "BOT", content: aiResult.content },
  });

  // Detect contact from AI state OR from message content (so we don't rely only on AI setting contactEmail/contactCaptured)
  const emailInMessages = chatMessages.some((m) => /@/.test(m.content));
  const phoneInMessages = chatMessages.some((m) => /\+?[\d\s-]{10,}/.test(m.content));
  const hasEmail = !!(
    mergedState.contactEmail?.trim() ||
    emailInMessages
  );
  const hasPhone = !!(
    mergedState.contactPhone?.trim() ||
    /\+?[\d\s-]{10,}/.test(content) ||
    phoneInMessages
  );
  const score = scoreLead(
    mergedState,
    hasEmail || !!mergedState.contactEmail,
    hasPhone || !!mergedState.contactPhone
  );

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      qualificationState: mergedState as object,
      score,
    },
  });

  const contactCaptured = !!(
    mergedState.contactEmail ||
    mergedState.contactPhone ||
    hasEmail ||
    hasPhone
  );
  // Treat any session with score >= 60 as a lead (contact is recommended but not required).
  const qualified = score >= 60;

  if (qualified && !contactCaptured) {
    console.warn("[lead] qualified without contact info", {
      sessionId,
      siteId: session.siteId,
      score,
      leadThreshold: config.leadThreshold,
      contactCaptured,
      hasEmail,
      hasPhone,
      mergedStateContact: !!mergedState.contactEmail || !!mergedState.contactPhone,
    });
  }
  let botMessage = aiResult.content;
  let leadId: string | null = null;

  const shouldCreateLead = qualified && (session.status === "OPEN" || session.status === "QUALIFIED");
  if (qualified && session.status !== "OPEN" && session.status === "QUALIFIED") {
    const existing = await prisma.lead.findUnique({ where: { sessionId } });
    if (!existing) {
      console.warn("[lead] session already QUALIFIED but no lead found (recovery): will create lead", { sessionId });
    }
  }

  if (shouldCreateLead) {
    const logCtx = { sessionId, siteId: session.siteId, tenantId: session.site.tenantId };
    console.info("[lead] qualified in chat", { ...logCtx, score, leadThreshold: config.leadThreshold, sessionStatus: session.status });

    const existingLead = await prisma.lead.findUnique({ where: { sessionId } });
    if (existingLead) {
      leadId = existingLead.id;
      console.info("[lead] lead already exists (idempotent/race)", { ...logCtx, leadId });
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: "QUALIFIED" },
      });
    } else {
      let lead: { id: string };
      try {
        lead = await prisma.lead.create({
          data: {
            sessionId,
            siteId: session.siteId,
            name: mergedState.contactName ?? null,
            email: mergedState.contactEmail ?? null,
            phone: mergedState.contactPhone ?? null,
            company: mergedState.contactCompany ?? null,
            score,
            qualified: true,
            crmProvider: "NONE",
          },
        });
        console.info("[lead] created in database", { ...logCtx, leadId: lead.id });
      } catch (createErr: unknown) {
        const code = createErr && typeof createErr === "object" && "code" in createErr ? (createErr as { code: string }).code : null;
        if (code === "P2002") {
          const existing = await prisma.lead.findUnique({ where: { sessionId } });
          if (existing) {
            lead = existing;
            console.info("[lead] race: lead created by concurrent request", { ...logCtx, leadId: lead.id });
          } else {
            console.error("[lead] create failed with P2002 but no existing lead", { ...logCtx }, createErr);
            throw createErr;
          }
        } else {
          console.error("[lead] create failed", { ...logCtx }, createErr);
          throw createErr;
        }
      }
      leadId = lead.id;

      let summary: string;
      try {
        summary = await generateSummary(
          messages.map((m) => ({ role: m.role, content: m.content })).concat([
            { role: "VISITOR", content },
            { role: "BOT", content: aiResult.content },
          ])
        );
      } catch (summaryErr) {
        console.error("[lead] generateSummary failed; keeping lead, using fallback summary", { ...logCtx, leadId }, summaryErr);
        summary = "Summary unavailable.";
      }
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: "QUALIFIED", summary },
      });

      const tenantId = session.site.tenantId;
      const webhookConn = await prisma.crmConnection.findUnique({
        where: { tenantId_provider: { tenantId, provider: "WEBHOOK" } },
      });
      if (webhookConn?.webhookUrl) {
        try {
          await addCrmJob({ leadId: lead.id, tenantId, provider: "WEBHOOK" });
        } catch (e) {
          console.error("[lead] Enqueue webhook job failed", { ...logCtx, leadId: lead.id }, e);
        }
      }
      const hubspotConn = await prisma.crmConnection.findUnique({
        where: { tenantId_provider: { tenantId, provider: "HUBSPOT" } },
      });
      if (hubspotConn?.hubspotAccessToken) {
        try {
          await addCrmJob({ leadId: lead.id, tenantId, provider: "HUBSPOT" });
        } catch (e) {
          console.error("[lead] Enqueue HubSpot job failed", { ...logCtx, leadId: lead.id }, e);
        }
      }
      try {
        const { runWorkflowsForLead } = await import("@/lib/workflows");
        await runWorkflowsForLead(lead.id, tenantId, "LEAD_QUALIFIED");
      } catch (e) {
        console.error("[lead] Workflows failed", { ...logCtx, leadId: lead.id }, e);
      }
    }
  }

  if (qualified && leadId) {
    console.info("[lead] qualified response sent to widget", { sessionId, leadId });
  }

  return NextResponse.json({
    ok: true,
    botMessage: { content: botMessage },
    score,
    qualified: qualified ? true : undefined,
    leadId: leadId ?? undefined,
  });
}
