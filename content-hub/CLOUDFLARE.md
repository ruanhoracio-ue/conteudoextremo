# Migração: Vercel → Cloudflare Pages

Guia da migração do Content Hub (frontend Vite + API) do Vercel para o
Cloudflare Pages + Pages Functions. Tudo roda no Cloudflare — não há servidor
Node separado.

## O que mudou no repositório

| Antes (Vercel) | Depois (Cloudflare) |
| :--- | :--- |
| `api/index.js` (Express via `serverless-http`) | `functions/api/[[path]].js` + `cf/app.js` (Hono) |
| `server/routes/*.js` (Express) | `cf/routes/*.js` (Hono, mesma lógica) |
| `process.env.*` | `c.env.*` (bindings do Worker) |
| Persistência em `/tmp/*.json` (`fs`) | Cloudflare **KV** (`CONTENT_HUB_KV`) |
| `vercel.json` (rewrites) | `public/_redirects` + Pages Functions |

> O código antigo do Vercel (`api/`, `server/`, `vercel.json`) foi **mantido**,
> então o deploy no Vercel continua funcionando até você virar o DNS. O runtime
> do Cloudflare usa exclusivamente `functions/` + `cf/`.

## Endpoints (paridade 1:1 com o Express)

`/api/health`, `/api/auth/*`, `/api/data`, `/api/ai/generate`,
`/api/claude/*`, `/api/instagram/*`, `/api/youtube/*`, `/api/mineracao/*`.

## Passo a passo do deploy

### 1. Instalar dependências
```bash
cd content-hub
npm install          # adiciona hono + wrangler
```

### 2. Criar o namespace KV (substitui o /tmp)
```bash
npx wrangler kv namespace create CONTENT_HUB_KV
npx wrangler kv namespace create CONTENT_HUB_KV --preview
```
Copie os `id` e `preview_id` retornados para dentro de `wrangler.jsonc`
(campos `id` e `preview_id`).

### 3. Criar o projeto Pages
No painel Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**,
selecione o repositório e configure o build:

| Campo | Valor |
| :--- | :--- |
| **Root directory** | `content-hub` |
| **Framework preset** | Vite |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

(O `wrangler.jsonc` já declara `pages_build_output_dir: dist` e o binding de KV.)

### 4. Variáveis de ambiente (secrets)
Em **Pages → Settings → Environment variables**, adicione (Production e Preview):
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`,
`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`,
`INSTAGRAM_USER_ID`, `REDIRECT_URI`.

Além disso, o front usa (build-time, prefixo `VITE_`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`. **Não** defina `VITE_API_URL` — em produção o app
chama `/api` no mesmo domínio (Pages Functions), que é o padrão.

### 5. Ligar o KV ao projeto Pages
Se preferir pelo painel: **Pages → Settings → Functions → KV namespace
bindings** → variável `CONTENT_HUB_KV` → selecione o namespace criado no passo 2.
(Isso é equivalente ao bloco `kv_namespaces` do `wrangler.jsonc`.)

### 6. Domínio
**Pages → Custom domains** → adicione `conteudo.conversaoextrema.com`. Como o DNS
já está na Cloudflare, é só apontar o CNAME para o projeto Pages. Atualize o
`REDIRECT_URI` do Instagram para
`https://conteudo.conversaoextrema.com/api/instagram/callback` (e cadastre essa
URL no app do Facebook).

## Dev local (com Functions + KV)
```bash
cp .dev.vars.example .dev.vars   # preencha as chaves
npm run cf:dev                   # build + wrangler pages dev (porta 8788)
```
O `wrangler pages dev` simula KV localmente e lê `.dev.vars`.

Deploy manual (fora do Git):
```bash
npm run cf:deploy
```

## Notas / pendências conhecidas

- **`/api/instagram/configure`** guarda o token em memória do isolate — no
  Workers isso é efêmero (some entre requests). A fonte confiável são as
  variáveis `INSTAGRAM_ACCESS_TOKEN`/`INSTAGRAM_USER_ID`. Se quiser que o
  `/configure` persista, dá para gravá-lo no KV também (não fiz para manter
  paridade com o comportamento atual).
- **Bug pré-existente (não tocado):** `src/lib/api.js` chama
  `api.post('/api/instagram/configure', …)`, e como `API_URL` já é `/api`, o path
  final vira `/api/api/instagram/configure` (404). Isso já não funcionava no
  Vercel. Também há `api.gerarCalendario()` chamando `/api/ai/gerar-calendario`,
  rota que nunca existiu no backend. Mantive a paridade; posso corrigir ambos se
  você quiser.
- **KV é eventualmente consistente.** Para os volumes de auth/data aqui é ok e é
  muito mais durável que o `/tmp` de antes. Se quiser consistência forte /
  relacional depois, o próximo passo natural é migrar auth/data para o Supabase
  (que o projeto já usa no frontend) ou para Cloudflare D1.

## Rollback
Como o Vercel continua configurado (`vercel.json` + `api/` intactos), se algo
der errado é só reapontar o DNS de volta para o Vercel — nada no código do
Vercel foi removido.
