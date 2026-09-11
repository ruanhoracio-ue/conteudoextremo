import { Hono } from 'hono'

// Cofre de senhas da equipe: logins e senhas dos sites e softwares usados.
// Persistido em Cloudflare KV sob a chave `cofre` (binding CONTENT_HUB_KV).
//
// Aviso: o conteúdo é guardado em texto puro e a API não exige autenticação
// — decisão tomada para a primeira versão. Uma senha mestra (cifrando no
// navegador) ou o Cloudflare Access na frente do app podem entrar depois
// sem mudar este formato.
//
// O cofre inteiro é um único documento com número de versão. Salvar exige
// mandar a versão que foi lida; se outra pessoa salvou antes, devolve 409
// com o estado atual para o cliente recarregar em vez de sobrescrever.
export const cofreRouter = new Hono()

const KV_KEY = 'cofre'
const MAX_ITENS = 2000
const CAMPOS = ['id', 'nome', 'url', 'categoria', 'login', 'senha', 'observacoes', 'createdAt', 'updatedAt']
const LIMITE = { observacoes: 4000, senha: 1000 }

function vazio() {
  return { versao: 0, itens: [], updatedAt: null }
}

async function carregar(env) {
  const kv = env && env.CONTENT_HUB_KV
  if (!kv) return null
  try {
    const raw = await kv.get(KV_KEY)
    if (!raw) return vazio()
    const data = JSON.parse(raw)
    return {
      versao: Number.isInteger(data.versao) ? data.versao : 0,
      itens: Array.isArray(data.itens) ? data.itens : [],
      updatedAt: data.updatedAt || null,
    }
  } catch (err) {
    console.error('Erro ao ler o cofre do KV:', err)
    return vazio()
  }
}

// Mantém só os campos conhecidos, como string, com limite de tamanho.
function limparItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const item = {}
  for (const campo of CAMPOS) {
    const v = raw[campo]
    if (v == null) continue
    const s = String(v)
    item[campo] = s.slice(0, LIMITE[campo] || 500)
  }
  if (!item.id || !item.nome || !item.nome.trim()) return null
  return item
}

// GET /api/cofre
cofreRouter.get('/', async (c) => {
  const cofre = await carregar(c.env)
  if (!cofre) return c.json({ error: 'KV (CONTENT_HUB_KV) não está vinculado.' }, 500)
  return c.json(cofre)
})

// PUT /api/cofre  { versao, itens }
cofreRouter.put('/', async (c) => {
  const kv = c.env && c.env.CONTENT_HUB_KV
  if (!kv) return c.json({ error: 'KV (CONTENT_HUB_KV) não está vinculado.' }, 500)

  const body = await c.req.json().catch(() => null)
  if (!body || !Array.isArray(body.itens) || !Number.isInteger(body.versao)) {
    return c.json({ error: 'Corpo inválido: esperado { versao, itens[] }.' }, 400)
  }
  if (body.itens.length > MAX_ITENS) {
    return c.json({ error: `O cofre aceita até ${MAX_ITENS} itens.` }, 413)
  }

  const atual = await carregar(c.env)
  if (body.versao !== atual.versao) {
    return c.json({ error: 'O cofre foi alterado por outra pessoa.', ...atual }, 409)
  }

  const itens = body.itens.map(limparItem).filter(Boolean)
  const novo = { versao: atual.versao + 1, itens, updatedAt: new Date().toISOString() }

  try {
    await kv.put(KV_KEY, JSON.stringify(novo))
  } catch (err) {
    console.error('Erro ao salvar o cofre no KV:', err)
    return c.json({ error: 'Falha ao salvar o cofre.' }, 500)
  }
  return c.json(novo)
})
