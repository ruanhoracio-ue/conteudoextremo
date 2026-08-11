# Migração: Vercel → Cloudflare Workers

Guia da migração do Content Hub (frontend Vite + API) do Vercel para o
**Cloudflare Workers** com **Static Assets**. Tudo roda num único Worker —
não há servidor Node separado e não usa Cloudflare Pages.

## O que mudou no repositório

| Antes (Vercel) | Depois (Cloudflare Workers) |
| :--- | :--- |
| `api/index.js` (Express via `serverless-http`) | `worker.js` + `cf/app.js` (Hono) |
| `server/routes/*.js` (Express) | `cf/routes/*.js` (Hono, mesma lógica) |
| `process.env.*` | `c.env.*` (bindings do Worker) |
| Persistência em `/tmp/*.json` (`fs`) | Cloudflare **KV** (`CONTENT_HUB_KV`) |
| `vercel.json` (rewrites) | `worker.js` (roteia /api) + Static Assets (SPA) |

> O código antigo do Vercel (`api/`, `server/`, `vercel.json`) foi **mantido**,
> então o deploy no Vercel continua funcionando até você virar o DNS.

## Como o Worker funciona (`worker.js`)
- Requests `/api/*` → app Hono (`cf/app.js`) — mesmos endpoints de sempre
- Todo o resto → assets estáticos (`env.ASSETS`), com fallback SPA
  (`not_found_handling: single-page-application` no `wrangler.jsonc`)

## Endpoints (paridade 1:1 com o Express)
`/api/health`, `/api/auth/*`, `/api/data`, `/api/ai/generate`,
`/api/claude/*`, `/api/instagram/*`, `/api/youtube/*`, `/api/mineracao/*`.

## Passo a passo do deploy

### 1. Instalar dependências
```bash
cd content-hub
npm install
```

### 2. KV (já criado na conta Universo Extremo)
Namespaces já existentes e referenciados no `wrangler.jsonc`:
- `content_hub_kv`          → `id` (produção)
- `content_hub_kv_preview`  → `preview_id`

### 3. Criar o Worker conectado ao Git
Cloudflare → **Workers & Pages → Create → Workers → Import a repository** →
seleciona `conteudoextremo`. Configuração:

| Campo | Valor |
| :--- | :--- |
| **Root directory** (Path) | `content-hub` |
| **Build command** | `npm run build` |
| **Deploy command** | `npx wrangler deploy` |
| **Non-production branch deploy** | `npx wrangler versions upload` |

(O `wrangler.jsonc` já declara `main`, `assets` e o binding de KV.)

### 4. Variáveis de ambiente
Em **Settings → Variables and Secrets**, adicione (Production e Preview):
- **Obrigatórias (frontend/build):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **IA/analytics (opcionais):** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`, `FACEBOOK_APP_ID`,
  `FACEBOOK_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `REDIRECT_URI`

> NÃO defina `VITE_API_URL` — em produção o app chama `/api` no mesmo domínio.

### 5. Domínio
**Settings → Domains & Routes** → adicionar `conteudo.conversaoextrema.com`.
Se o domínio estiver na mesma conta Cloudflare, a Cloudflare configura o DNS.
Se estiver em outra conta, crie um CNAME `conteudo → <worker>.workers.dev` na
zona e valide. Atualize o `REDIRECT_URI` do Instagram para
`https://conteudo.conversaoextrema.com/api/instagram/callback`.

## Dev local
```bash
cp .dev.vars.example .dev.vars   # preencha as chaves
npm run cf:dev                   # build + wrangler dev
```

Deploy manual:
```bash
npm run cf:deploy                # build + wrangler deploy
```

## Notas
- **`/api/instagram/configure`** guarda o token em memória do isolate (efêmero
  no Workers). A fonte confiável são as variáveis de ambiente.
- **KV é eventualmente consistente** — ok para auth/data aqui, e muito mais
  durável que o `/tmp` de antes.
- Os dados reais do app (criativos, vídeos, etc.) vivem no **Supabase**, não no
  KV — a migração não toca no banco.

## Rollback
O Vercel continua configurado (`vercel.json` + `api/` intactos). Se precisar, é
só reapontar o DNS de volta para o Vercel.
