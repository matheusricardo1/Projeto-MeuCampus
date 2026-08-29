FROM node:22-alpine AS deps
WORKDIR /worker
COPY workers/moodle/package.json workers/moodle/package-lock.json* ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /worker
COPY --from=deps /worker/node_modules ./node_modules
COPY workers/moodle/ .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /worker
ENV NODE_ENV=production
COPY workers/moodle/package.json workers/moodle/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /worker/dist ./dist
CMD ["node", "dist/main.js"]
