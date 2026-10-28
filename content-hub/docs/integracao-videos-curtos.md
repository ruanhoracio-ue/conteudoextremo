# API de integração — Vídeos Curtos

Endereço para marcar um vídeo curto como **Agendado** ou **Publicado** sem abrir
o app (pensado para o Claude de quem agenda no Metricool).

Base: `https://conteudoextremo.conversaoextrema.com/api/integracao`

## Chave de acesso

Toda chamada leva a chave no cabeçalho `Authorization: Bearer <chave>`
(ou `X-Api-Key: <chave>`). O servidor guarda só o SHA-256 da chave
(secret `INTEGRACAO_KEY_SHA256` do Worker); sem chave ou com chave errada a
resposta é `401`.

Para trocar a chave:

```bash
# gera uma chave nova e mostra o hash
node -e 'const c=require("crypto");const k=c.randomBytes(32).toString("base64url");console.log("chave:",k);console.log("hash: ",c.createHash("sha256").update(k).digest("hex"))'
# grava o hash no Worker (cole o hash quando pedir)
npx wrangler@4 secret put INTEGRACAO_KEY_SHA256
```

## Achar o vídeo

Cada vídeo mostra na tabela do app os 8 primeiros caracteres do id (clique
copia o id completo). A API aceita o id completo ou esse prefixo (mínimo 6
caracteres). Se o prefixo bater com mais de um vídeo, responde `409` com os
candidatos.

```bash
# lista (mais recentes primeiro); filtros opcionais: busca (título ou início do id), status, limite
curl -s "$BASE/videos-curtos?busca=bets&status=aprovado" -H "Authorization: Bearer $CHAVE"

# um vídeo
curl -s "$BASE/videos-curtos/3096fab5" -H "Authorization: Bearer $CHAVE"
```

Resposta (resumo): `id`, `titulo`, `categoria`, `status` (`fila`, `editado`,
`emAprovacao`, `alteracao`, `aprovado`, `agendado`, `publicado`),
`dataAgendada`, `linkPost`, `linkFinalizado`, `postadoTiktok`, `postadoShorts`,
`atualizadoEm`.

## Mudar o status

`POST /videos-curtos/:id/status` (ou `PATCH`) com JSON:

| campo          | obrigatório            | formato                                    |
| -------------- | ---------------------- | ------------------------------------------ |
| `status`       | sim                    | `"agendado"` ou `"publicado"`              |
| `dataAgendada` | sim para `agendado`    | ISO 8601, ex. `2026-10-30T14:00:00-03:00`  |
| `linkPost`     | não                    | URL `http(s)://...`                        |

```bash
# agendou no Metricool
curl -s -X POST "$BASE/videos-curtos/3096fab5/status" \
  -H "Authorization: Bearer $CHAVE" -H "Content-Type: application/json" \
  -d '{"status":"agendado","dataAgendada":"2026-10-30T14:00:00-03:00"}'

# foi publicado (com o link do post)
curl -s -X POST "$BASE/videos-curtos/3096fab5/status" \
  -H "Authorization: Bearer $CHAVE" -H "Content-Type: application/json" \
  -d '{"status":"publicado","linkPost":"https://www.tiktok.com/@conta/video/123"}'
```

Resposta: `{ "ok": true, "video": { ... } }`. Marcar `agendado` também marca as
etapas anteriores (editado, em aprovação, aprovado); marcar `publicado`
mantém a data agendada e o link. O app atualiza sozinho em até alguns segundos
(a lista é sincronizada por polling).

## Erros

- `400` corpo/campos inválidos (a mensagem diz qual)
- `401` chave ausente ou errada
- `404` vídeo não encontrado
- `409` prefixo de id ambíguo (vem `candidatos`)
- `502` falha ao falar com o banco
- `503` secret da chave não configurado no Worker
