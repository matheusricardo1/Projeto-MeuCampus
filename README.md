# UFAM Academics API

Backend NestJS da integracao com o eCampus.

## Variaveis de ambiente

Copie `.env.example` para `.env` em desenvolvimento ou configure essas variaveis no provedor de deploy:

- `PORT`: porta HTTP. Padrao: `3001`.
- `FRONTEND_ORIGIN`: origem permitida no CORS. Use virgula para multiplas origens.
- `ECAMPUS_JWT_SECRET`: chave usada para assinar o Bearer token do app.
- `ECAMPUS_JWT_EXPIRES_IN`: expiracao do JWT. Padrao: `2h`.

## Scripts

```bash
npm run dev
npm run build
npm run start:prod
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
docker build -t ufam-academics-api .
docker run --env-file .env -p 3001:3001 ufam-academics-api
```
