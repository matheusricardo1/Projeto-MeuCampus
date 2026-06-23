# Meu Campus App

Aplicativo React Native com Expo para acessar as informacoes academicas do eCampus por meio da API do Meu Campus.

Este projeto e independente da API: possui dependencias, scripts, variaveis de ambiente e fluxo de deploy proprios. Nao ha workspace unificado nem pacote compartilhado de contratos.

## Responsabilidade

O app concentra a experiencia do usuario:

- Tela de login com credenciais institucionais.
- Consulta de perfil academico.
- Consulta de notas por ano e periodo.
- Consulta de horario de aulas.
- Consulta de planos de ensino.
- Interface responsiva para navegador e app.
- Design system proprio com foco em clareza, seguranca e uso academico.

O app nao acessa o eCampus diretamente. Toda comunicacao passa pela API configurada em `EXPO_PUBLIC_ECAMPUS_API_URL`.

## Tecnologias

- React Native
- Expo
- React Native Web
- TypeScript
- Async Storage
- Expo Linear Gradient
- Expo Status Bar
- Lucide React Native
- React Native Safe Area Context

## Estrutura

```text
src/
+-- application/      Casos de uso do app
+-- domain/           Entidades, contratos e erros de dominio
+-- infrastructure/   HTTP, storage e integracoes locais
`-- presentation/     Telas, hooks, composicao e design system
```

## Variaveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Configure a URL da API:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=http://127.0.0.1:3001
```

No Android Emulator, use:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=http://10.0.2.2:3001
```

Em aparelho fisico, use o IP da maquina que esta rodando o backend na mesma rede:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=http://192.168.0.10:3001
```

Em producao, use HTTPS:

```bash
EXPO_PUBLIC_ECAMPUS_API_URL=https://sua-api.example.com
```

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Inicie o Expo:

```bash
npm run start
```

Rodar especificamente para web:

```bash
npm run web
```

Rodar para Android:

```bash
npm run android
```

Rodar para iOS:

```bash
npm run ios
```

## Scripts

```bash
npm run start        # Inicia o Expo em modo offline
npm run start:clear  # Inicia o Expo limpando cache
npm run start:online # Inicia o Expo sem modo offline
npm run android      # Abre o app no Android
npm run ios          # Abre o app no iOS
npm run web          # Abre o app no navegador
npm run build:web    # Exporta a versao web em web-build/
npm run typecheck    # Valida TypeScript sem emitir arquivos
npm run audit        # Executa npm audit com nivel moderate
```

Os scripts locais usam `EXPO_OFFLINE=1` para evitar chamadas desnecessarias do Expo CLI durante o desenvolvimento. Use `npm run start:online` quando precisar autenticar com Expo/EAS.

## Validacao

```bash
npm run typecheck
npm run build:web
npm run audit
```

## Build Web

```bash
npm run build:web
```

A saida fica em:

```text
web-build/
```

Configuracao comum para Vercel:

- Build Command: `npm run build:web`
- Output Directory: `web-build`
- Environment Variable: `EXPO_PUBLIC_ECAMPUS_API_URL=https://sua-api.example.com`

Para Android e iOS nativos, use Expo/EAS Build em vez de Vercel.

## Seguranca no App

- O app nao salva senha do usuario.
- A senha e enviada apenas para a API durante o login.
- O app armazena a sessao autenticada retornada pela API.
- Em producao, a URL da API deve usar HTTPS.
- O frontend deve consumir apenas os campos que a API disponibiliza para a interface.

## Observacoes

- O app depende da API do Meu Campus para autenticar e consultar dados.
- O eCampus continua sendo a fonte oficial das informacoes academicas.
- Este app nao e oficial da UFAM.
