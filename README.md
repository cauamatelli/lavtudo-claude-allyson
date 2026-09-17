# LavTudo

Aplicação comercial da LavTudo Lavanderia Express para acompanhamento de ciclos em tempo real. O funcionário controla as etapas no painel e o cliente acompanha a máquina pelo celular usando o QR Code permanente ou a etiqueta NFC do equipamento.

## Fluxo principal

1. A lavanderia possui quatro lavadoras e quatro secadoras cadastradas permanentemente.
2. Cada máquina tem uma URL fixa, como `/acompanhar/lavadora-01`.
3. O QR Code impresso e a etiqueta NFC usam essa mesma URL em todos os ciclos.
4. O funcionário inicia e atualiza o ciclo da máquina no painel autenticado.
5. O estado real é persistido no Supabase e a tela pública exibe as mudanças automaticamente.
6. Quando a roupa é retirada, o funcionário libera a máquina para um novo ciclo sem alterar sua URL.

Rotas principais:

- `/` — página institucional;
- `/scan` — leitura do QR Code ou da etiqueta NFC da máquina;
- `/acompanhar/lavadora-01` até `/acompanhar/lavadora-04` — lavadoras;
- `/acompanhar/secadora-01` até `/acompanhar/secadora-04` — secadoras;
- `/admin` — painel autenticado do funcionário;

## Stack

- React 19, TypeScript, TanStack Start/Router e Vite;
- APIs server-side em `src/routes/api`;
- autenticação por cookie HTTP-only assinado;
- validação de entradas com Zod;
- QR Code em SVG com `qrcode.react`;
- PostgreSQL no Supabase com RLS e histórico persistente;
- sincronização entre painel e cliente por polling curto e tolerante a falhas.

Nenhum segredo é incluído no bundle do frontend. Variáveis sem o prefixo `VITE_` são lidas somente no servidor.

## Instalação

```bash
npm install
copy .env.example .env.local
npm run dev
```

Para acessar pelo celular na mesma rede local:

```bash
npm run dev:network
```

## Variáveis de ambiente

```dotenv
LAVTUDO_ADMIN_USER=admin
LAVTUDO_ADMIN_PASSWORD=admin
LAVTUDO_SESSION_SECRET=uma-chave-aleatoria-longa
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

As credenciais `admin` / `admin` foram mantidas conforme solicitado. Altere-as antes de colocar o painel em uso público permanente. As três variáveis do Supabase são obrigatórias. A chave publishable atende somente às consultas públicas protegidas por RLS; a chave secreta é lida exclusivamente pelas rotas server-side e nunca deve receber o prefixo `VITE_`.

As migrações versionadas estão em `supabase/migrations`.

## Verificação

```bash
npm run check
```

Esse comando executa TypeScript, ESLint e o build de produção.
