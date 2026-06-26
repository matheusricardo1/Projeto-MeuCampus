FROM node:22-alpine AS deps
WORKDIR /ai-worker
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /ai-worker
COPY --from=deps /ai-worker/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /ai-worker
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /ai-worker/dist ./dist
CMD ["node", "dist/main.js"]
