import OpenAI from "openai";
import path from "path";
import fs from "fs";
import type { QualificationState } from "@leadbot/shared";

function loadKeyFromEnvFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/OPENAI_API_KEY\s*=\s*["']?([^"'\n#]+)["']?/);
    const value = match?.[1]?.trim() ?? "";
    return value;
  } catch {
    return "";
  }
}

export function getOpenAI(): OpenAI {
  let key = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!key || key.startsWith("sk-...")) {
    const cwd = process.cwd();
    const pathsToTry = [
      path.join(cwd, ".env"),
      path.join(cwd, ".env.local"),
      path.join(cwd, "apps", "web", ".env"),
      path.join(cwd, "apps", "web", ".env.local"),
    ];
    for (const p of pathsToTry) {
      key = loadKeyFromEnvFile(p);
      if (key && !key.startsWith("sk-...")) break;
    }
  }
  if (!key || key.startsWith("sk-...")) {
    throw new Error("OPENAI_API_KEY is not set or is placeholder. Add your key to apps/web/.env and restart the server.");
  }
  return new OpenAI({ apiKey: key });
}

export type AiResponseResult = {
  content: string;
  qualificationState: QualificationState;
};

export async function generateResponse(params: {
  systemPrompt: string;
  messages: { role: "VISITOR" | "BOT"; content: string }[];
  kbChunks: string[];
  currentState: QualificationState | null;
  siteHistoryContext: string;
}): Promise<AiResponseResult> {
  const { systemPrompt, messages, kbChunks, currentState, siteHistoryContext } = params;

  const systemParts = [systemPrompt.trim()];

  if (siteHistoryContext.trim()) {
    systemParts.push(
      "Learn from past conversations on this site. Use them to match tone, avoid repeated mistakes, and improve how you advise and qualify:\n" +
        siteHistoryContext.trim()
    );
  }

  if (kbChunks.length > 0) {
    systemParts.push("Relevant knowledge:\n" + kbChunks.slice(0, 5).join("\n\n"));
  }

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...messages.map((m) => ({
      role: m.role === "VISITOR" ? "user" as const : "assistant" as const,
      content: m.content,
    })),
  ];

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: chatMessages,
    max_tokens: 400,
    temperature: 0.5,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let content = raw;
  let qualificationState: QualificationState = currentState ?? {};

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      content = raw.replace(jsonMatch[0], "").trim();
      qualificationState = {
        intent: typeof parsed.intent === "string" ? parsed.intent : undefined,
        urgency: typeof parsed.urgency === "string" ? parsed.urgency : undefined,
        budgetSignal: typeof parsed.budgetSignal === "string" ? parsed.budgetSignal : undefined,
        serviceType: typeof parsed.serviceInterest === "string"
          ? parsed.serviceInterest
          : typeof parsed.serviceType === "string"
            ? parsed.serviceType
            : undefined,
        timeline: typeof parsed.timeline === "string" ? parsed.timeline : undefined,
        contactCaptured: typeof parsed.contactCaptured === "boolean" ? parsed.contactCaptured : undefined,
        companySizeSignal: typeof parsed.companySizeSignal === "string" ? parsed.companySizeSignal : undefined,
        contactEmail: typeof parsed.contactEmail === "string" ? parsed.contactEmail : undefined,
        contactPhone: typeof parsed.contactPhone === "string" ? parsed.contactPhone : undefined,
        contactName: typeof parsed.contactName === "string" ? parsed.contactName : undefined,
        contactCompany: typeof parsed.contactCompany === "string" ? parsed.contactCompany : undefined,
        location: typeof parsed.location === "string" ? parsed.location : undefined,
        notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
      };
    } catch {
      // keep content as full response if JSON parse fails
    }
  }
  if (!content) content = "How can I help you today?";

  return { content, qualificationState };
}

export async function generateSummary(messages: { role: string; content: string }[]): Promise<string> {
  const text = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Summarize this sales chat in 5 bullet points for the sales team. End with one line: Next step: [suggestion].",
      },
      { role: "user", content: text },
    ],
    max_tokens: 300,
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content ?? "No summary.";
}
