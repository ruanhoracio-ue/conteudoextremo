import { Hono } from 'hono'

// Cofre de senhas da equipe — versão com senha mestra.
//
// O servidor NUNCA vê senhas em texto puro. O navegador gera uma chave do
// cofre aleatória que cifra os dados (AES-256-GCM). A senha mestra e a chave
// de recuperação apenas "envelopam" essa chave. De cada uma delas o navegador
// deriva também um token de acesso (256 bits), e aqui guardamos só o
// SHA-256 desse token: sem o token certo a API não entrega nem o conteúdo
// cifrado, nem deixa gravar ou apagar.
//
// Documento no KV (chave `cofre`):
//   {
//     configurado, versao, iteracoes, updatedAt,
//     mestra:      { salt, authHash, envelope },
//     recuperacao: { salt, authHash, envelope },
//     dados: "<base64 iv+ciphertext>",
//     historico: [ { versao, dados, updatedAt } ]   // últimas versões, cifradas
//   }
export const cofreRouter = new Hono()

const KV_KEY = 'cofre'
const MAX_HISTORICO = 10
const MAX_DADOS = 2 * 1024 * 1024 // 2 MB de ciphertext em base64
const HEX64 = /^[0-9a-f]{64}$/

// Respostas do cofre nunca podem ser guardadas por cache algum.
cofreRouter.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('Pragma', 'no-cache')
})

function kvDe(c) {
  return c.env && c.env.CONTENT_HUB_KV ? c.env.CONTENT_HUB_KV : null
}

async function carregar(kv) {
  const raw = await kv.get(KV_KEY)
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    return d && d.configurado ? d : null
  } catch (err) {
    console.error('Cofre: documento inválido no KV:', err)
    return null
  }
}

async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Comparação em tempo constante: não vaza, pelo tempo de resposta, em qual
// caractere o hash divergiu.
function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function credencialValida(cred) {
  return cred && typeof cred === 'object'
    && typeof cred.salt === 'string' && cred.salt.length >= 16 && cred.salt.length <= 64
    && typeof cred.authHash === 'string' && HEX64.test(cred.authHash)
    && typeof cred.envelope === 'string' && cred.envelope.length >= 32 && cred.envelope.length <= 512
}

function dadosValidos(dados) {
  return typeof dados === 'string' && dados.length > 0 && dados.length <= MAX_DADOS
}

function metaHistorico(doc) {
  return (doc.historico || []).map(h => ({ versao: h.versao, updatedAt: h.updatedAt }))
}

// ---------- rotas públicas (antes do middleware de autenticação) ----------

// GET /api/cofre/status — o navegador precisa dos salts para derivar as
// chaves antes de conseguir se autenticar. Salts não são segredo.
cofreRouter.get('/status', async (c) => {
  const kv = kvDe(c)
  if (!kv) return c.json({ error: 'KV (CONTENT_HUB_KV) não está vinculado.' }, 500)
  const doc = await carregar(kv)
  if (!doc) return c.json({ configurado: false })
  return c.json({
    configurado: true,
    iteracoes: doc.iteracoes,
    mestra: { salt: doc.mestra.salt },
    recuperacao: { salt: doc.recuperacao.salt },
  })
})

// POST /api/cofre/configurar — só funciona uma vez, enquanto o cofre não existe.
cofreRouter.post('/configurar', async (c) => {
  const kv = kvDe(c)
  if (!kv) return c.json({ error: 'KV (CONTENT_HUB_KV) não está vinculado.' }, 500)

  if (await carregar(kv)) {
    return c.json({ error: 'O cofre já foi configurado por outra pessoa.' }, 409)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || !credencialValida(body.mestra) || !credencialValida(body.recuperacao) || !dadosValidos(body.dados)
      || !Number.isInteger(body.iteracoes) || body.iteracoes < 100000) {
    return c.json({ error: 'Corpo inválido para configurar o cofre.' }, 400)
  }

  const agora = new Date().toISOString()
  const doc = {
    configurado: true,
    versao: 1,
    iteracoes: body.iteracoes,
    mestra: { salt: body.mestra.salt, authHash: body.mestra.authHash, envelope: body.mestra.envelope },
    recuperacao: { salt: body.recuperacao.salt, authHash: body.recuperacao.authHash, envelope: body.recuperacao.envelope },
    dados: body.dados,
    historico: [],
    updatedAt: agora,
  }
  await kv.put(KV_KEY, JSON.stringify(doc))
  return c.json({ versao: doc.versao, updatedAt: agora })
})

// ---------- autenticação: token derivado da senha mestra ou da recuperação ----------

cofreRouter.use('*', async (c, next) => {
  const kv = kvDe(c)
  if (!kv) return c.json({ error: 'KV (CONTENT_HUB_KV) não está vinculado.' }, 500)

  const doc = await carregar(kv)
  if (!doc) return c.json({ error: 'O cofre ainda não foi configurado.', configurado: false }, 409)

  const token = c.req.header('x-cofre-auth') || ''
  if (!token || token.length > 256) return c.json({ error: 'Não autorizado.' }, 401)

  const hash = await sha256Hex(token)
  let papel = null
  if (iguais(hash, doc.mestra.authHash)) papel = 'mestra'
  else if (iguais(hash, doc.recuperacao.authHash)) papel = 'recuperacao'
  if (!papel) return c.json({ error: 'Não autorizado.' }, 401)

  c.set('cofre', doc)
  c.set('papel', papel)
  await next()
})

// GET /api/cofre — conteúdo cifrado + envelopes (só para quem tem o token)
cofreRouter.get('/', (c) => {
  const doc = c.get('cofre')
  return c.json({
    versao: doc.versao,
    dados: doc.dados,
    updatedAt: doc.updatedAt,
    papel: c.get('papel'),
    mestra: { salt: doc.mestra.salt, envelope: doc.mestra.envelope },
    recuperacao: { salt: doc.recuperacao.salt, envelope: doc.recuperacao.envelope },
    historico: metaHistorico(doc),
  })
})

// PUT /api/cofre  { versao, dados } — grava nova versão, guardando a anterior no histórico
cofreRouter.put('/', async (c) => {
  const kv = kvDe(c)
  const doc = c.get('cofre')
  const body = await c.req.json().catch(() => null)

  if (!body || !Number.isInteger(body.versao) || !dadosValidos(body.dados)) {
    return c.json({ error: 'Corpo inválido: esperado { versao, dados }.' }, 400)
  }
  if (body.versao !== doc.versao) {
    return c.json({
      error: 'O cofre foi alterado por outra pessoa.',
      versao: doc.versao, dados: doc.dados, updatedAt: doc.updatedAt, historico: metaHistorico(doc),
    }, 409)
  }

  const agora = new Date().toISOString()
  const historico = [{ versao: doc.versao, dados: doc.dados, updatedAt: doc.updatedAt }, ...(doc.historico || [])]
    .slice(0, MAX_HISTORICO)
  const novo = { ...doc, versao: doc.versao + 1, dados: body.dados, updatedAt: agora, historico }

  try {
    await kv.put(KV_KEY, JSON.stringify(novo))
  } catch (err) {
    console.error('Cofre: falha ao gravar no KV:', err)
    return c.json({ error: 'Falha ao salvar o cofre.' }, 500)
  }
  return c.json({ versao: novo.versao, dados: novo.dados, updatedAt: agora, historico: metaHistorico(novo) })
})

// GET /api/cofre/historico/:versao — uma versão anterior (cifrada), para restaurar
cofreRouter.get('/historico/:versao', (c) => {
  const doc = c.get('cofre')
  const v = parseInt(c.req.param('versao'), 10)
  const item = (doc.historico || []).find(h => h.versao === v)
  if (!item) return c.json({ error: 'Versão não encontrada no histórico.' }, 404)
  return c.json(item)
})

// POST /api/cofre/senha-mestra  { mestra: { salt, authHash, envelope } }
// Troca a senha mestra: só o envelope e o token mudam; os dados e a
// recuperação continuam iguais.
cofreRouter.post('/senha-mestra', async (c) => {
  const kv = kvDe(c)
  const doc = c.get('cofre')
  const body = await c.req.json().catch(() => null)
  if (!body || !credencialValida(body.mestra)) {
    return c.json({ error: 'Corpo inválido para trocar a senha mestra.' }, 400)
  }
  const novo = { ...doc, mestra: { salt: body.mestra.salt, authHash: body.mestra.authHash, envelope: body.mestra.envelope }, updatedAt: new Date().toISOString() }
  try {
    await kv.put(KV_KEY, JSON.stringify(novo))
  } catch (err) {
    console.error('Cofre: falha ao trocar a senha mestra:', err)
    return c.json({ error: 'Falha ao salvar a nova senha mestra.' }, 500)
  }
  return c.json({ ok: true })
})
