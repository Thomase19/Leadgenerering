import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getSitesForTenant } from "@/lib/tenancy";
import { DeleteSiteButton } from "./DeleteSiteButton";

export default async function SitesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const sites = await getSitesForTenant(session.user.tenantId);
  if (sites.length === 0) redirect("/onboarding");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Sider</h1>
        <Link
          href="/sites/new"
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Tilføj side
        </Link>
      </div>
      <ul className="space-y-3">
        {sites.map((site) => (
          <li
            key={site.id}
            className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between"
          >
            <div>
              <Link
                href={`/sites/${site.id}/config`}
                className="font-medium text-slate-800 hover:text-blue-600"
              >
                {site.domain}
              </Link>
              <p className="text-sm text-slate-500 mt-0.5">
                Side-ID: {site.id} · Widget {site.widgetConfig ? "konfigureret" : "ikke konfigureret"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/sites/${site.id}/knowledge`}
                className="text-sm text-slate-600 hover:underline"
              >
                Viden
              </Link>
              <Link
                href={`/sites/${site.id}/config`}
                className="text-sm text-blue-600 hover:underline"
              >
                Konfigurer
              </Link>
              <DeleteSiteButton siteId={site.id} domain={site.domain} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
