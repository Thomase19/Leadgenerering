import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantAIProfileForm } from "./tenant-ai-profile-form";

export default async function TenantAISettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;

  const [profile, templates, tenant] = await Promise.all([
    prisma.tenantAIProfile.findFirst({ where: { tenantId } }),
    prisma.industryPromptTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, industryKey: true, name: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  if (!tenant) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">AI-assistent</h1>
      <p className="text-sm text-slate-600 mb-6 max-w-2xl">
        Tilpas hvordan din AI-assistent opfører sig for netop din virksomhed. Disse indstillinger påvirker,
        hvordan chatbotten svarer, hvilke spørgsmål den stiller, og hvordan den kvalificerer leads.
      </p>
      <TenantAIProfileForm
        tenantName={tenant.name}
        initialProfile={profile}
        templates={templates}
      />
    </div>
  );
}

