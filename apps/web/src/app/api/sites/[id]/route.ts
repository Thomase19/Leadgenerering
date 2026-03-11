import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTenantForUser, getSiteForTenant } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await getTenantForUser(session.user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: siteId } = await params;
  const site = await getSiteForTenant(siteId, ctx.tenantId);
  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });

  await prisma.site.delete({ where: { id: siteId } });
  return NextResponse.json({ ok: true });
}
