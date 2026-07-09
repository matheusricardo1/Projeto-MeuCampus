FROM node:22-alpine AS deps
WORKDIR /app
COPY api/package.json api/package-lock.json ./
COPY api/prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY api/ .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/package-lock.json ./
COPY api/prisma ./prisma
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["sh", "-c", "npm run prisma:migrate && npm run start:prod"]
