"use client";

import { useState } from "react";
import type { TenantAIProfile } from "@prisma/client";

type TemplateSummary = { id: string; industryKey: string; name: string };

type Props = {
  tenantName: string;
  initialProfile: TenantAIProfile | null;
  templates: TemplateSummary[];
};

export function TenantAIProfileForm({ tenantName, initialProfile, templates }: Props) {
  const [companyName, setCompanyName] = useState(initialProfile?.companyName ?? tenantName);
  const [industry, setIndustry] = useState(initialProfile?.industry ?? "");
  const [industryTemplateId, setIndustryTemplateId] = useState(initialProfile?.industryTemplateId ?? "");
  const [companyDescription, setCompanyDescription] = useState(initialProfile?.companyDescription ?? "");
  const [servicesOffered, setServicesOffered] = useState(initialProfile?.servicesOffered ?? "");
  const [targetAudience, setTargetAudience] = useState(initialProfile?.targetAudience ?? "");
  const [companyValues, setCompanyValues] = useState(initialProfile?.companyValues ?? "");
  const [toneOfVoiceOverride, setToneOfVoiceOverride] = useState(initialProfile?.toneOfVoiceOverride ?? "");
  const [faqContent, setFaqContent] = useState(initialProfile?.faqContent ?? "");
  const [openingHours, setOpeningHours] = useState(initialProfile?.openingHours ?? "");
  const [geographicArea, setGeographicArea] = useState(initialProfile?.geographicArea ?? "");
  const [leadQualificationGoals, setLeadQualificationGoals] = useState(
    initialProfile?.leadQualificationGoals ?? ""
  );
  const [qualificationQuestionsRaw, setQualificationQuestionsRaw] = useState(
    initialProfile?.qualificationQuestions
      ? JSON.stringify(initialProfile.qualificationQuestions, null, 2)
      : `[
  { "id": "q1", "question": "Hvad bringer dig her i dag?", "required": true }
]`
  );
  const [disallowedTopics, setDisallowedTopics] = useState(initialProfile?.disallowedTopics ?? "");
  const [escalationInstructions, setEscalationInstructions] = useState(
    initialProfile?.escalationInstructions ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);

    let parsedQuestions: unknown = undefined;
    if (qualificationQuestionsRaw.trim()) {
      try {
        parsedQuestions = JSON.parse(qualificationQuestionsRaw);
      } catch {
        setSaving(false);
        setError("Spørgsmål skal være gyldig JSON.");
        return;
      }
    }

    const res = await fetch("/api/ai/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: companyName.trim() || null,
        industry: industry.trim() || null,
        industryTemplateId: industryTemplateId || null,
        companyDescription: companyDescription.trim() || null,
        servicesOffered: servicesOffered.trim() || null,
        targetAudience: targetAudience.trim() || null,
        companyValues: companyValues.trim() || null,
        toneOfVoiceOverride: toneOfVoiceOverride.trim() || null,
        faqContent: faqContent.trim() || null,
        openingHours: openingHours.trim() || null,
        geographicArea: geographicArea.trim() || null,
        leadQualificationGoals: leadQualificationGoals.trim() || null,
        qualificationQuestions: parsedQuestions,
        disallowedTopics: disallowedTopics.trim() || null,
        escalationInstructions: escalationInstructions.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Kunne ikke gemme AI-profil.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Virksomhedsnavn</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Branche (nøgle)</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="fx car_dealership, clinic, construction_trades"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Branche-skabelon</label>
        <select
          value={industryTemplateId ?? ""}
          onChange={(e) => setIndustryTemplateId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Ingen (kun skræddersyet adfærd)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.industryKey})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Vælg en branchespecifik skabelon som udgangspunkt. Du kan altid overskrive med dine egne tekster nedenfor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kort beskrivelse</label>
          <textarea
            value={companyDescription}
            onChange={(e) => setCompanyDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Services / ydelser</label>
          <textarea
            value={servicesOffered}
            onChange={(e) => setServicesOffered(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Målgruppe</label>
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Værdier</label>
          <textarea
            value={companyValues}
            onChange={(e) => setCompanyValues(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tone of voice</label>
          <textarea
            value={toneOfVoiceOverride}
            onChange={(e) => setToneOfVoiceOverride(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Fx: Venlig, jordnær og konkret. Ingen fluff, fokus på næste skridt."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Åbningstider / tilgængelighed</label>
          <textarea
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Fx: Hverdage 8-16. Bruges kun som kontekst i prompten."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Geografisk område</label>
        <textarea
          value={geographicArea}
          onChange={(e) => setGeographicArea(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Fx: København og omegn."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Lead mål / kvalificeringslogik</label>
        <textarea
          value={leadQualificationGoals}
          onChange={(e) => setLeadQualificationGoals(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Beskriv hvad en god lead er for jer, og hvad AI’en skal prøve at finde ud af."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Kvalifikationsspørgsmål (JSON)
        </label>
        <textarea
          value={qualificationQuestionsRaw}
          onChange={(e) => setQualificationQuestionsRaw(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
        <p className="text-xs text-slate-500 mt-1">
          Valgfrit. Liste af objekter med <code>id</code>, <code>question</code> og{" "}
          <code>required</code>. Disse kombineres med spørgsmål fra widget-konfigurationen.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">FAQ / svar-skabelon</label>
        <textarea
          value={faqContent}
          onChange={(e) => setFaqContent(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Indsæt typiske spørgsmål og svar, som AI’en må bruge direkte."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Forbudte / begrænsede emner</label>
          <textarea
            value={disallowedTopics}
            onChange={(e) => setDisallowedTopics(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Eskalerings-regler</label>
          <textarea
            value={escalationInstructions}
            onChange={(e) => setEscalationInstructions(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Beskriv hvornår AI’en skal foreslå at tale med et menneske (fx komplekse sager, booking, priser osv.)."
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">AI-profil gemt.</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Gemmer..." : "Gem AI-profil"}
        </button>
      </div>
    </form>
  );
}

