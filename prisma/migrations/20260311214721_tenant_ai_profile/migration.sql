-- CreateTable
CREATE TABLE "TenantAIProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT,
    "industry" TEXT,
    "companyDescription" TEXT,
    "servicesOffered" TEXT,
    "targetAudience" TEXT,
    "companyValues" TEXT,
    "toneOfVoiceOverride" TEXT,
    "faqContent" TEXT,
    "openingHours" TEXT,
    "geographicArea" TEXT,
    "leadQualificationGoals" TEXT,
    "qualificationQuestions" JSONB,
    "disallowedTopics" TEXT,
    "escalationInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "industryTemplateId" TEXT,

    CONSTRAINT "TenantAIProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryPromptTemplate" (
    "id" TEXT NOT NULL,
    "industryKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseIndustryPrompt" TEXT NOT NULL,
    "suggestedQuestions" JSONB,
    "qualificationLogic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantAIProfile_tenantId_key" ON "TenantAIProfile"("tenantId");

-- CreateIndex
CREATE INDEX "TenantAIProfile_tenantId_idx" ON "TenantAIProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryPromptTemplate_industryKey_key" ON "IndustryPromptTemplate"("industryKey");

-- AddForeignKey
ALTER TABLE "TenantAIProfile" ADD CONSTRAINT "TenantAIProfile_industryTemplateId_fkey" FOREIGN KEY ("industryTemplateId") REFERENCES "IndustryPromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAIProfile" ADD CONSTRAINT "TenantAIProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
