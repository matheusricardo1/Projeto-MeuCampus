# Meu Campus API

Backend NestJS responsavel por integrar o app Meu Campus ao eCampus.

Este projeto e independente do app: possui dependencias, scripts, variaveis de ambiente e fluxo de deploy proprios. Nao ha workspace unificado nem pacote compartilhado de contratos.

## Responsabilidade

A API funciona como uma camada de proxy e seguranca entre o frontend e o eCampus:

- Recebe as credenciais no login.
- Autentica no eCampus sob demanda.
- Emite um JWT para o app.
- Consulta dados academicos no eCampus.
- Normaliza e minimiza as respostas para o frontend.
- Aplica validacao de entrada, rate limiting, CORS e headers de seguranca.
- Evita expor detalhes internos do eCampus para o app.

## Tecnologias

- NestJS
- TypeScript
- Axios
- Tough Cookie
- Axios CookieJar Support
- Node HTML Parser
- JWT
- Dotenv
- Arquitetura Hexagonal
- DDD

## Estrutura

```text
src/
+-- modules/ecampus/
|   +-- application/     Casos de uso
|   +-- domain/          Modelos, contratos e erros
|   +-- infrastructure/  Cliente HTTP, autenticacao e parser do eCampus
|   `-- presentation/    Controllers, DTOs, guards e decorators
+-- shared/              Middlewares, logging e utilitarios
+-- health.controller.ts Health check raiz
`-- main.ts              Bootstrap HTTP
```

## Endpoints

```text
GET  /ecampus/health
POST /ecampus/login
POST /ecampus/logout
GET  /ecampus/profile
GET  /ecampus/grades?year=2026&period=1
GET  /ecampus/schedule
GET  /ecampus/lesson-plans
GET  /ecampus/lesson-plans/:planId
```

As rotas autenticadas usam Bearer Token:

```text
Authorization: Bearer <token>
```

## Variaveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Variaveis disponiveis:

```bash
PORT=3001
FRONTEND_ORIGIN=http://localhost:8081
ECAMPUS_JWT_SECRET=replace-with-another-long-random-secret
ECAMPUS_JWT_EXPIRES_IN=2h
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_MAX_REQUESTS=5
LOGIN_RATE_LIMIT_WINDOW_MS=60000
```

Descricoes:

- `PORT`: porta HTTP da API. Padrao: `3001`.
- `FRONTEND_ORIGIN`: origens permitidas no CORS. Use virgula para multiplas origens.
- `ECAMPUS_JWT_SECRET`: chave usada para assinar tokens do app.
- `ECAMPUS_JWT_EXPIRES_IN`: tempo de validade do JWT. Padrao: `2h`.
- `RATE_LIMIT_MAX_REQUESTS`: limite geral de requisicoes por IP.
- `RATE_LIMIT_WINDOW_MS`: janela do rate limit geral em milissegundos.
- `LOGIN_RATE_LIMIT_MAX_REQUESTS`: limite de tentativas de login por IP.
- `LOGIN_RATE_LIMIT_WINDOW_MS`: janela do rate limit de login em milissegundos.

Em producao, configure `FRONTEND_ORIGIN` somente com origens HTTPS especificas. A API rejeita wildcard (`*`) em producao e exige HTTPS via proxy header `x-forwarded-proto`.

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Rode em desenvolvimento:

```bash
npm run dev
```

Verifique o health check:

```text
GET http://localhost:3001/ecampus/health
```

## Scripts

```bash
npm run dev        # Roda src/main.ts com ts-node
npm run build      # Compila TypeScript para dist/
npm run start      # Roda dist/main.js
npm run start:prod # Roda dist/main.js
npm run typecheck  # Valida TypeScript sem emitir arquivos
npm run audit      # Executa npm audit com nivel moderate
```

## Validacao

```bash
npm run typecheck
npm run build
npm run audit
```

## Build e Producao

```bash
npm install
npm run build
npm run start:prod
```

O build gera os arquivos em:

```text
dist/
```

## Deploy com Docker

```bash
docker build -t meu-campus-api .
docker run --env-file .env -p 3001:3001 meu-campus-api
```

## Deploy Serverless

A pasta `api/` dentro deste projeto contem um handler para ambientes serverless que precisam exportar uma funcao HTTP. Esse handler inicializa o NestJS a partir de `dist/server` e reutiliza a instancia em cache entre requests.

```text
api/index.js
```

## Seguranca

- A API nao salva senha do usuario.
- A senha e usada apenas no fluxo de autenticacao com o eCampus.
- As sessoes do eCampus ficam apenas em memoria durante a vida do processo.
- O frontend recebe um JWT para chamadas autenticadas.
- Entradas como CPF, senha, ano, periodo e `planId` sao validadas.
- Rate limiting reduz abuso e excesso de requisicoes.
- Logs nao devem conter senha ou dados sensiveis.
- Respostas devem conter apenas os dados necessarios ao frontend.
- Em producao, use HTTPS entre frontend, API e qualquer proxy.

## Disclaimer

Este backend integra um projeto independente e nao oficial da UFAM. O eCampus continua sendo a fonte oficial dos dados academicos.
