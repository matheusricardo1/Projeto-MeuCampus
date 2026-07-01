FROM node:22-alpine AS deps
WORKDIR /worker
COPY workers/ecampus/package.json workers/ecampus/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /worker
COPY --from=deps /worker/node_modules ./node_modules
COPY workers/ecampus/ .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /worker
ENV NODE_ENV=production
COPY workers/ecampus/package.json workers/ecampus/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /worker/dist ./dist
CMD ["node", "dist/main.js"]
