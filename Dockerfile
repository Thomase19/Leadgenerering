# LeadBot web app - pnpm monorepo (avoids Railway using npm)
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

COPY . .

# Install deps and build in order; ensure @leadbot/shared is available for web build.
# In CI (Railway) we allow lockfile to be updated if needed.
RUN pnpm install --no-frozen-lockfile && \
  pnpm db:generate && \
  pnpm build:widget && \
  cp apps/widget/dist/leadbot.js apps/web/public/widget/ 2>/dev/null || true && \
  pnpm --filter shared build && \
  mkdir -p apps/web/node_modules/@leadbot && \
  cp -r packages/shared apps/web/node_modules/@leadbot/shared && \
  pnpm --filter web build

ENV NODE_ENV=production
EXPOSE 3000
# Migrations on start, then Next.js
CMD ["sh", "-c", "pnpm db:migrate:deploy && pnpm --filter web start"]
