## Tenant-specific AI prompt architecture

This project now supports a **dynamic, multi-tenant AI prompt architecture** for the chatbot.

Each tenant can configure how their AI assistant behaves, and the runtime prompt is built per tenant/site on every request.

### Where prompts are built

- Core builder: `apps/web/src/lib/ai/promptBuilder.ts`
  - `buildSystemPromptFromInputs(...)` – pure function that composes a system prompt string from:
    - global base behavior
    - tenant AI profile
    - industry prompt template
    - widget configuration (greeting, tone, qualification questions, lead threshold)
    - mode (support / lead / offline / booking)
  - `buildSystemPromptForTenant({ tenantId, siteId, mode, outsideBusinessHours })` – loads data via Prisma and calls `buildSystemPromptFromInputs`.

- AI provider: `apps/web/src/lib/ai/provider.ts`
  - `generateResponse({ systemPrompt, messages, kbChunks, currentState, siteHistoryContext })`
  - Uses the `systemPrompt` from the builder as the system message for OpenAI.

- Chat entrypoint: `apps/web/src/app/api/widget/message/route.ts`
  - Determines tenant + site, outside-business-hours, and site history.
  - Calls `buildSystemPromptForTenant(...)` to get the final system prompt.
  - Passes that prompt into `generateResponse(...)`.

### Data model for tenant AI behavior

Prisma models (see `prisma/schema.prisma`):

- `TenantAIProfile`
  - Linked 1–1 to `Tenant` via `tenantId`.
  - Holds business-specific AI configuration:
    - `companyName`, `industry`, `companyDescription`, `servicesOffered`, `targetAudience`, `companyValues`
    - `toneOfVoiceOverride`, `faqContent`, `openingHours`, `geographicArea`
    - `leadQualificationGoals`, `qualificationQuestions` (JSON), `disallowedTopics`, `escalationInstructions`
    - Optional `industryTemplateId` pointing to an industry template.

- `IndustryPromptTemplate`
  - Global, reusable templates keyed by `industryKey` (e.g. `car_dealership`, `construction_trades`, `clinic`).
  - Fields:
    - `baseIndustryPrompt` – high-level behavior and examples.
    - `suggestedQuestions` (JSON) – typical questions for that industry.
    - `qualificationLogic` – narrative description of what a good lead looks like.

### Dashboard / admin UI

- Navigation link: `AI-assistent` in `apps/web/src/components/DashboardNav.tsx` → `/settings/ai`.
- Page: `apps/web/src/app/(dashboard)/settings/ai/page.tsx`
  - Server component that:
    - Authenticates the user
    - Loads the current `TenantAIProfile` for the tenant (if any)
    - Loads all `IndustryPromptTemplate` options
    - Renders `TenantAIProfileForm`.

- Form component: `apps/web/src/app/(dashboard)/settings/ai/tenant-ai-profile-form.tsx`
  - Lets the tenant configure:
    - Company name, industry key
    - Description, services, target audience, values
    - Tone of voice, opening hours, geographic area
    - Lead qualification goals
    - Qualification questions (raw JSON, merged with widget config questions)
    - FAQ content
    - Disallowed topics
    - Escalation instructions
    - Industry template selection
  - Submits to `/api/ai/profile`.

- API: `apps/web/src/app/api/ai/profile/route.ts`
  - `GET` – returns current `TenantAIProfile` for the logged-in tenant.
  - `POST` – validates input with Zod and upserts `TenantAIProfile`.

### How the prompt is generated at runtime

When a visitor sends a message to the widget:

1. `POST /api/widget/message`
2. Route loads the `ChatSession` including `site` and `site.widgetConfig`.
3. Using `session.site.tenantId` and `session.siteId`, it calls:
   - `buildSystemPromptForTenant({ tenantId, siteId, mode: "lead", outsideBusinessHours })`
4. `buildSystemPromptForTenant`:
   - Loads `Tenant`, `Site`, `WidgetConfig`, `TenantAIProfile`
   - Resolves `IndustryPromptTemplate` either by `industryTemplateId` or `industry` key
   - Calls `buildSystemPromptFromInputs(...)`
5. The resulting system prompt string is passed into `generateResponse(...)` along with:
   - chat messages
   - relevant knowledge chunks (KB)
   - previous qualification state
   - recent summaries for this site (site history)
6. `generateResponse` sends a chat completion request with:
   - System message = composed prompt (plus history + KB)
   - User/assistant messages from the conversation
7. The AI output includes:
   - Natural language reply
   - A JSON block describing updated `QualificationState`:
     - `intent`, `urgency`, `budgetSignal`, `serviceInterest`, `timeline`, `location`
     - `contactCaptured`, `companySizeSignal`
     - `contactEmail`, `contactPhone`, `contactName`, `contactCompany`
     - `notes`

The backend then stores this structured state on the `ChatSession` and uses it to create/update leads and scoring.

### Industry-specific behavior

Industry behavior is driven by `IndustryPromptTemplate` and merged into the prompt:

- The `baseIndustryPrompt` is included as an “industry-specific behavior” section.
- `qualificationLogic` is injected so the AI understands what a “good lead” looks like for that industry.
- `suggestedQuestions` are added as recommended questions, with `whenToAsk` hints.

Examples seeded in `prisma/seed.ts`:

- `car_dealership`
- `construction_trades`
- `clinic`

The demo tenant’s AI profile is linked to `car_dealership` as a concrete example.

### Lead qualification structure

The prompt explicitly instructs the AI to build a structured state with:

- `intent`, `urgency`, `budgetSignal`, `serviceInterest`, `timeline`, `location`
- `contactCaptured`, `companySizeSignal`
- `contactEmail`, `contactPhone`, `contactName`, `contactCompany`
- `notes`

The AI is told to:

- Ask and infer these over time, not as a rigid form.
- Only include keys that are supported by the conversation (avoid hallucination).
- Summarize the lead and propose next steps for the sales team when the visitor is clearly interested.

### Safety and fallbacks

- The prompt includes:
  - Instructions to stay within the company’s scope.
  - Warnings not to provide harmful/medical/legal/financial advice.
  - Tenant-specific `disallowedTopics` and `escalationInstructions` when set.
- If `Tenant`, `Site`, or `WidgetConfig` are missing, `buildSystemPromptForTenant` builds a **generic but safe** fallback prompt.

### How to add new industries

1. Add a new `IndustryPromptTemplate` row (via Prisma, migration, or seed):
   - `industryKey`: a unique key, e.g. `b2b_services`, `real_estate`.
   - `name`: human-friendly name.
   - `baseIndustryPrompt`: description of how the assistant should behave for that industry.
   - `suggestedQuestions`: JSON array of `{ question, whenToAsk }`.
   - `qualificationLogic`: description of good leads and buying signals.
2. In the tenant AI settings page (`/settings/ai`), choose this template for a tenant.
3. Optionally override with tenant-specific AI profile fields.

### How to safely edit AI behavior

- Prefer editing `TenantAIProfile` fields through the dashboard UI instead of touching code.
- When changing core behavior:
  - Adjust `baseIndustryPrompt` and `qualificationLogic` in `IndustryPromptTemplate` to affect many tenants at once.
  - Refine `leadQualificationGoals`, `qualificationQuestions`, and `faqContent` per tenant.
- Keep safety rules in place:
  - Do not remove the global “stay in scope / no harmful advice” instructions in `promptBuilder.ts`.
  - Use `disallowedTopics` and `escalationInstructions` to tighten behavior where needed.

