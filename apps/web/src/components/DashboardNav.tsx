"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Forside" },
  { href: "/sites", label: "Sider" },
  { href: "/leads", label: "Leads" },
  { href: "/sessions", label: "Sessioner" },
  { href: "/workflows", label: "Workflows" },
  { href: "/integrations", label: "Integrationer" },
  { href: "/analytics", label: "Rapporter" },
  { href: "/settings/ai", label: "AI-assistent" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`block rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === href || pathname.startsWith(href + "/")
              ? "bg-blue-50 text-blue-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
