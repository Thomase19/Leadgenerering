"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteSiteButton({
  siteId,
  domain,
}: {
  siteId: string;
  domain: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Er du sikker på, at du vil slette "${domain}"? Dette kan ikke fortrydes.`
      )
    )
      return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Kunne ikke slette siden.");
        return;
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {isDeleting ? "Sletter…" : "Slet"}
    </button>
  );
}
