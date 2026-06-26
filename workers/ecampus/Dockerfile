FROM node:22-alpine AS deps
WORKDIR /worker
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /worker
COPY --from=deps /worker/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /worker
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /worker/dist ./dist
CMD ["node", "dist/main.js"]

