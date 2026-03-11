import { prisma } from "./prisma";
import type { Tenant, User, Site } from "@prisma/client";

export type TenantContext = {
  tenantId: string;
  userId: string;
  user: User & { tenant: Tenant };
};

/**
 * Enforce tenant scope: only return data for the given tenant.
 * Use in all dashboard queries.
 */
export async function getTenantForUser(userId: string): Promise<TenantContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!user) return null;
  return { tenantId: user.tenantId, userId: user.id, user };
}

export function assertTenantMatch(tenantId: string, context: TenantContext) {
  if (context.tenantId !== tenantId) {
    throw new Error("Forbidden: tenant mismatch");
  }
}

export async function getSitesForTenant(tenantId: string) {
  return prisma.site.findMany({
    where: { tenantId },
    include: { widgetConfig: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSiteForTenant(siteId: string, tenantId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, tenantId },
    include: { widgetConfig: true },
  });
}

export type LeadFilterOpts = {
  siteId?: string;
  qualified?: boolean;
  from?: Date;
  to?: Date;
  minScore?: number;
  maxScore?: number;
  search?: string;
  crmProvider?: "NONE" | "WEBHOOK" | "HUBSPOT" | "all";
};

export async function getLeadsForTenant(
  tenantId: string,
  opts: LeadFilterOpts = {}
) {
  const where: Record<string, unknown> = { site: { tenantId } };
  if (opts.siteId) where.siteId = opts.siteId;
  if (opts.qualified !== undefined) where.qualified = opts.qualified;
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) (where.createdAt as Record<string, Date>).gte = opts.from;
    if (opts.to) (where.createdAt as Record<string, Date>).lte = opts.to;
  }
  if (opts.minScore !== undefined || opts.maxScore !== undefined) {
    where.score = {};
    if (opts.minScore !== undefined)
      (where.score as Record<string, number>).gte = opts.minScore;
    if (opts.maxScore !== undefined)
      (where.score as Record<string, number>).lte = opts.maxScore;
  }
  if (opts.crmProvider && opts.crmProvider !== "all") {
    where.crmProvider = opts.crmProvider;
  }
  if (opts.search?.trim()) {
    const term = opts.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } },
      { notes: { contains: term, mode: "insensitive" } },
    ];
  }
  const take = 1000;
  const leads = await prisma.lead.findMany({
    where,
    include: { site: true, session: true },
    orderBy: { createdAt: "desc" },
    take,
  });
  const total = await prisma.lead.count({ where });
  if (total > take) {
    console.warn("[lead] dashboard query capped: showing %d of %d leads for tenant %s", leads.length, total, tenantId);
  }
  return leads;
}

export async function deleteLeadForTenant(leadId: string, tenantId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, site: { tenantId } },
  });
  if (!lead) return false;
  await prisma.lead.delete({ where: { id: leadId } });
  return true;
}

export async function getSessionsForTenant(
  tenantId: string,
  opts: { siteId?: string; status?: string } = {}
) {
  const where: Record<string, unknown> = { site: { tenantId } };
  if (opts.siteId) where.siteId = opts.siteId;
  if (opts.status) where.status = opts.status;
  return prisma.chatSession.findMany({
    where,
    include: { site: true, _count: { select: { messages: true } } },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
}

export async function getSessionForTenant(sessionId: string, tenantId: string) {
  return prisma.chatSession.findFirst({
    where: { id: sessionId, site: { tenantId } },
    include: { messages: true, site: true, lead: true },
  });
}

export async function createAuditLog(
  tenantId: string,
  action: string,
  meta?: Record<string, unknown>,
  actorUserId?: string
) {
  return prisma.auditLog.create({
    data: { tenantId, action, meta: meta ?? {}, actorUserId },
  });
}
