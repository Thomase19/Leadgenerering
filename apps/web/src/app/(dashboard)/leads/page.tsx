import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getLeadsForTenant, getSitesForTenant } from "@/lib/tenancy";
import { LeadsTable } from "./LeadsTable";
import { LeadsFilterForm } from "./LeadsFilterForm";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    siteId?: string;
    qualified?: string;
    from?: string;
    to?: string;
    minScore?: string;
    maxScore?: string;
    search?: string;
    crmProvider?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const params = await searchParams;
  const siteId = params.siteId && params.siteId !== "all" ? params.siteId : undefined;
  const qualified =
    params.qualified === "true" ? true : params.qualified === "false" ? false : undefined;
  const from =
    params.from && !Number.isNaN(Date.parse(params.from))
      ? new Date(params.from + "T00:00:00")
      : undefined;
  const to =
    params.to && !Number.isNaN(Date.parse(params.to))
      ? new Date(params.to + "T23:59:59.999")
      : undefined;
  const minScore = params.minScore !== undefined && params.minScore !== "" ? Number(params.minScore) : undefined;
  const maxScore = params.maxScore !== undefined && params.maxScore !== "" ? Number(params.maxScore) : undefined;
  const search = params.search?.trim() || undefined;
  const crmProvider =
    params.crmProvider && params.crmProvider !== "all"
      ? (params.crmProvider as "NONE" | "WEBHOOK" | "HUBSPOT")
      : undefined;

  const [leads, sites] = await Promise.all([
    getLeadsForTenant(session.user.tenantId, {
      siteId,
      qualified,
      from,
      to,
      minScore: minScore !== undefined && !Number.isNaN(minScore) ? minScore : undefined,
      maxScore: maxScore !== undefined && !Number.isNaN(maxScore) ? maxScore : undefined,
      search,
      crmProvider: crmProvider,
    }),
    getSitesForTenant(session.user.tenantId),
  ]);

  console.info("[lead] dashboard leads page: fetched %d leads for tenant %s", leads.length, session.user.tenantId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Leads</h1>

      <LeadsFilterForm
        sites={sites}
        defaultValues={{
          siteId: siteId ?? "all",
          qualified:
            qualified === undefined ? "all" : qualified ? "true" : "false",
          from: params.from ?? "",
          to: params.to ?? "",
          minScore: params.minScore ?? "",
          maxScore: params.maxScore ?? "",
          search: params.search ?? "",
          crmProvider: params.crmProvider ?? "all",
        }}
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Kontakt</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Side</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Score</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">CRM</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Oprettet</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700"></th>
              <th className="text-left py-3 px-4 font-medium text-slate-700 w-24">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            <LeadsTable leads={leads} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
