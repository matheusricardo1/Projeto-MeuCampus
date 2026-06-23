# Meu Campus Mobile

Aplicativo React Native com Expo para consumir o backend do eCampus.

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste a URL da API:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=http://127.0.0.1:3001
```

No Android Emulator, `10.0.2.2` costuma funcionar melhor:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=http://10.0.2.2:3001
```

Em aparelho fisico, use o IP da maquina que esta rodando o backend.

## Scripts

```bash
npm run start
npm run start:clear
npm run start:online
npm run android
npm run ios
npm run web
npm run build:web
npm run typecheck
npm audit
```

Os scripts locais usam `EXPO_OFFLINE=1` para evitar chamadas desnecessarias do Expo CLI para a API da Expo durante o desenvolvimento. Use `npm run start:online` quando precisar conectar com conta Expo/EAS.

O projeto esta fixado em Expo SDK 54 para abrir no Expo Go Android atual sem cair no erro de SDK incompativel observado com SDK 56.

## Validacao local

```bash
npm run typecheck
npx expo export --platform android --output-dir dist
npx expo export --platform web --output-dir web-build
```

## Deploy na Vercel

Este projeto sobe na Vercel como **Expo Web**.

Configure a variavel abaixo no projeto da Vercel antes do build:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=https://sua-api.example.com
```

Configuracao usada:

- Build Command: `npm run build:web`
- Output Directory: `web-build`

Para Android e iOS nativos, o caminho correto continua sendo o **Expo EAS Build**, nao a Vercel.
