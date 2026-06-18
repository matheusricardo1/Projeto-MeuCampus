# UFAM Academics App

Frontend Next.js do painel academico.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` em desenvolvimento ou configure no provedor de deploy:

- `NEXT_PUBLIC_ECAMPUS_API_URL`: URL publica do backend NestJS.

Exemplo local:

```bash
NEXT_PUBLIC_ECAMPUS_API_URL=http://localhost:3001
```

Exemplo em producao:

```bash
NEXT_PUBLIC_ECAMPUS_API_URL=https://api.seu-dominio.com
```

Como essa variavel usa o prefixo `NEXT_PUBLIC_`, ela e embutida no bundle do navegador durante o build. No deploy, configure esse valor antes de executar `npm run build`.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start:prod
```

## Deploy sem Docker

```bash
npm ci
NEXT_PUBLIC_ECAMPUS_API_URL=https://api.seu-dominio.com npm run build
PORT=3000 npm run start:prod
```

## Deploy com Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_ECAMPUS_API_URL=https://api.seu-dominio.com \
  -t ufam-academics-app .

docker run -p 3000:3000 ufam-academics-app
```
