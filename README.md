# Meu Campus

Este repositorio mantem os projetos do Meu Campus lado a lado, sem workspace unificado e sem pacote compartilhado.

## Estrutura

```text
app/  Aplicativo React Native com Expo.
api/  Backend NestJS da integracao com o eCampus.
```

Cada projeto tem seu proprio `package.json`, dependencias, scripts, variaveis de ambiente e fluxo de deploy. Execute comandos sempre dentro da pasta do projeto correspondente.

## Decisao de organizacao

Este repositorio nao usa monorepo formal, `npm workspaces`, `packages/contracts` ou tipos compartilhados entre app e API. As mudancas de contrato da API devem ser refletidas manualmente nos tipos do app quando necessario.

Essa escolha reduz complexidade no Expo/Metro e mantem os builds do app e da API independentes.

