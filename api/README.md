# Meu Campus API

Backend NestJS da integracao com o eCampus.

Este projeto e independente do app mobile: possui suas proprias dependencias, scripts e deploy. Nao ha workspace unificado nem pacote compartilhado de contratos.

## Variaveis de ambiente

Copie `.env.example` para `.env` em desenvolvimento ou configure essas variaveis no provedor de deploy:

- `PORT`: porta HTTP. Padrao: `3001`.
- `FRONTEND_ORIGIN`: origem permitida no CORS. Use virgula para multiplas origens.
- `ECAMPUS_JWT_SECRET`: chave usada para assinar o Bearer token do app.
- `ECAMPUS_JWT_EXPIRES_IN`: expiracao do JWT. Padrao: `2h`.
- `RATE_LIMIT_MAX_REQUESTS`: limite geral de requisicoes por IP. Padrao: `120`.
- `RATE_LIMIT_WINDOW_MS`: janela do limite geral em ms. Padrao: `60000`.
- `LOGIN_RATE_LIMIT_MAX_REQUESTS`: limite de tentativas de login por IP. Padrao: `5`.
- `LOGIN_RATE_LIMIT_WINDOW_MS`: janela do limite de login em ms. Padrao: `60000`.

Em producao, configure `FRONTEND_ORIGIN` somente com origens HTTPS especificas. O backend rejeita wildcard (`*`) em producao e exige HTTPS via proxy header `x-forwarded-proto`.

## Scripts

```bash
npm run dev
npm run build
npm run start:prod
npm audit
```

## Deploy sem Docker

```bash
npm ci
npm run build
npm run start:prod
```

O health check fica em:

```text
GET /ecampus/health
```

## Deploy com Docker

```bash
docker build -t meu-campus-api .
docker run --env-file .env -p 3001:3001 meu-campus-api
```
