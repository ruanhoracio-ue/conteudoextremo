import { Hono } from 'hono'
import { statusOf, updatesForStatus } from '../../src/lib/stageStatus.js'
import { STAGES_VIDEOS_CURTOS, normalizarDataAgendada, normalizarLinkPost } from '../../src/lib/agendamento.js'

// API de integração dos Vídeos Curtos (para o Claude/Metricool marcar
// "Agendado" ou "Publicado" sem abrir o app).
//
// Autenticação: toda chamada leva a chave em `Authorization: Bearer <chave>`
// (ou `X-Api-Key`). O Worker guarda só o SHA-256 da chave, no secret
// INTEGRACAO_KEY_SHA256 (`wrangler secret put INTEGRACAO_KEY_SHA256`), e
// compara em tempo constante. Sem o secret configurado a API responde 503.
//
// Rotas (todas sob /api/integracao):
//   GET  /videos-curtos?busca=&status=&limite=     lista (id, título, status...)
//   GET  /videos-curtos/:id                        um vídeo (id completo ou prefixo)
//   POST /videos-curtos/:id/status                 { status: 'agendado'|'publicado', dataAgendada?, linkPost? }
//
// O `:id` pode ser o UUID completo ou os primeiros caracteres (mínimo 6),
// como aparecem na tabela do app; se o prefixo bater com mais de um vídeo, 409.
export const integracaoRouter = new Hono()

const TABELA = 'videos_curtos'
const STAGES = STAGES_VIDEOS_CURTOS
const STATUS_PERMITIDOS = ['agendado', 'publicado']
const COLUNAS = 'id,titulo,categoria,editado,em_aprovacao,alteracao,aprovado,agendado,publicado,data_agendada,link_post,link_finalizado,postado_tiktok,postado_shorts,alteracao_nota,created_at,updated_at'
const HEX64 = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREFIXO = /^[0-9a-f-]{6,36}$/i

// O id é uuid no banco, e uuid não aceita LIKE. Um prefixo vira uma faixa:
// "3096fab5" -> de 3096fab5-0000-... até 3096fab5-ffff-... (uuid ordena byte a byte).
function faixaUuid(prefixo) {
  const hex = String(prefixo || '').toLowerCase().replace(/-/g, '')
  if (!/^[0-9a-f]{6,32}$/.test(hex)) return null
  const montar = (fill) => {
    const h = hex.padEnd(32, fill)
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  return { de: montar('0'), ate: montar('f') }
}

// Mesmo projeto Supabase do app (a chave é a pública, igual à do navegador).
const SUPABASE_URL_PADRAO = 'https://jtbcdnoiwocgfunckvvz.supabase.co'
const SUPABASE_KEY_PADRAO = 'sb_publishable_nCZQXm9MY_33E3NoHiw_7A_xVJMkWVD'

integracaoRouter.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function chaveDaRequisicao(c) {
  const auth = c.req.header('Authorization') || ''
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim()
  return (c.req.header('X-Api-Key') || '').trim()
}

// ---------- autenticação ----------
integracaoRouter.use('*', async (c, next) => {
  const esperado = (c.env && c.env.INTEGRACAO_KEY_SHA256 || '').trim().toLowerCase()
  if (!HEX64.test(esperado)) {
    return c.json({ error: 'API de integração não configurada (secret INTEGRACAO_KEY_SHA256 ausente).' }, 503)
  }
  const chave = chaveDaRequisicao(c)
  if (!chave) return c.json({ error: 'Chave de acesso ausente. Envie Authorization: Bearer <chave>.' }, 401)
  const hash = await sha256Hex(chave)
  if (!iguais(hash, esperado)) return c.json({ error: 'Chave de acesso inválida.' }, 401)
  await next()
})

// ---------- Supabase (REST) ----------
function supa(c) {
  const url = (c.env && c.env.SUPABASE_URL) || SUPABASE_URL_PADRAO
  const key = (c.env && c.env.SUPABASE_ANON_KEY) || SUPABASE_KEY_PADRAO
  return {
    async pedir(caminho, init = {}) {
      const res = await fetch(`${url}/rest/v1/${caminho}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(init.headers || {}),
        },
      })
      const texto = await res.text()
      let corpo = null
      try { corpo = texto ? JSON.parse(texto) : null } catch { corpo = { raw: texto } }
      if (!res.ok) {
        const err = new Error((corpo && (corpo.message || corpo.error)) || `Supabase respondeu ${res.status}`)
        err.status = res.status
        err.detalhe = corpo
        throw err
      }
      return corpo
    },
  }
}

function paraSaida(row) {
  if (!row) return null
  const item = {
    editado: !!row.editado, emAprovacao: !!row.em_aprovacao, alteracao: !!row.alteracao,
    aprovado: !!row.aprovado, agendado: !!row.agendado, publicado: !!row.publicado,
  }
  return {
    id: row.id,
    titulo: row.titulo || '',
    categoria: row.categoria || '',
    status: statusOf(item, STAGES) || 'fila',
    etapas: item,
    dataAgendada: row.data_agendada || null,
    linkPost: row.link_post || '',
    linkFinalizado: row.link_finalizado || '',
    alteracaoNota: row.alteracao_nota || '',
    postadoTiktok: !!row.postado_tiktok,
    postadoShorts: !!row.postado_shorts,
    criadoEm: row.created_at || null,
    atualizadoEm: row.updated_at || null,
  }
}

// Acha um vídeo pelo id completo ou por prefixo. Devolve { row } ou { erro, status }.
async function acharVideo(c, idParam) {
  const id = String(idParam || '').trim()
  if (!PREFIXO.test(id)) return { erro: 'Informe o id do vídeo (UUID completo ou pelo menos 6 caracteres iniciais).', status: 400 }
  const db = supa(c)
  if (UUID.test(id)) {
    const rows = await db.pedir(`${TABELA}?id=eq.${encodeURIComponent(id)}&select=${COLUNAS}&limit=1`)
    return rows && rows[0] ? { row: rows[0] } : { erro: 'Vídeo não encontrado.', status: 404 }
  }
  const faixa = faixaUuid(id)
  if (!faixa) return { erro: 'Id inválido: use só os caracteres do UUID.', status: 400 }
  const rows = await db.pedir(`${TABELA}?id=gte.${faixa.de}&id=lte.${faixa.ate}&select=${COLUNAS}&limit=3`)
  if (!rows || rows.length === 0) return { erro: 'Nenhum vídeo com esse início de id.', status: 404 }
  if (rows.length > 1) {
    return { erro: 'Mais de um vídeo começa com esse id; use mais caracteres.', status: 409, candidatos: rows.map(r => ({ id: r.id, titulo: r.titulo })) }
  }
  return { row: rows[0] }
}

function tratarErro(c, err) {
  console.error('Integração:', err)
  const status = err && err.status === 404 ? 404 : 502
  return c.json({ error: `Falha ao acessar o banco: ${err && err.message ? err.message : 'erro desconhecido'}` }, status)
}

// ---------- rotas ----------
integracaoRouter.get('/videos-curtos', async (c) => {
  const busca = (c.req.query('busca') || '').trim()
  const status = (c.req.query('status') || '').trim()
  const limite = Math.min(Math.max(parseInt(c.req.query('limite') || '50', 10) || 50, 1), 200)
  const partes = [`select=${COLUNAS}`, 'order=updated_at.desc.nullslast,created_at.desc', `limit=${limite}`]
  if (busca) {
    const b = busca.replace(/[%,()*]/g, ' ').trim()
    const faixa = faixaUuid(b)
    if (faixa) partes.push(`or=(titulo.ilike.*${encodeURIComponent(b)}*,and(id.gte.${faixa.de},id.lte.${faixa.ate}))`)
    else if (b) partes.push(`titulo=ilike.*${encodeURIComponent(b)}*`)
  }
  try {
    let rows = await supa(c).pedir(`${TABELA}?${partes.join('&')}`)
    let videos = (rows || []).map(paraSaida)
    if (status) videos = videos.filter(v => v.status === status)
    return c.json({ videos, total: videos.length })
  } catch (err) {
    return tratarErro(c, err)
  }
})

integracaoRouter.get('/videos-curtos/:id', async (c) => {
  try {
    const r = await acharVideo(c, c.req.param('id'))
    if (r.erro) return c.json({ error: r.erro, candidatos: r.candidatos }, r.status)
    return c.json({ video: paraSaida(r.row) })
  } catch (err) {
    return tratarErro(c, err)
  }
})

async function mudarStatus(c) {
  let corpo
  try { corpo = await c.req.json() } catch { return c.json({ error: 'Corpo inválido: envie JSON.' }, 400) }
  const status = String(corpo && corpo.status || '').trim().toLowerCase()
  if (!STATUS_PERMITIDOS.includes(status)) {
    return c.json({ error: `status deve ser um de: ${STATUS_PERMITIDOS.join(', ')}.` }, 400)
  }

  const updates = { ...updatesForStatus(STAGES, status), updated_at: new Date().toISOString() }

  if (corpo.dataAgendada !== undefined) {
    const iso = normalizarDataAgendada(corpo.dataAgendada)
    if (corpo.dataAgendada !== null && corpo.dataAgendada !== '' && !iso) {
      return c.json({ error: 'dataAgendada inválida; use ISO 8601 (ex.: 2026-10-30T14:00:00-03:00).' }, 400)
    }
    updates.data_agendada = iso
  } else if (status === 'agendado') {
    return c.json({ error: 'Para "agendado", informe dataAgendada (ISO 8601).' }, 400)
  }

  if (corpo.linkPost !== undefined) {
    const link = normalizarLinkPost(corpo.linkPost)
    if (link === null) return c.json({ error: 'linkPost inválido; precisa começar com http:// ou https://.' }, 400)
    updates.link_post = link
  }

  try {
    const r = await acharVideo(c, c.req.param('id'))
    if (r.erro) return c.json({ error: r.erro, candidatos: r.candidatos }, r.status)
    // camelCase (lib compartilhada com o app) -> snake_case (colunas)
    const corpoDb = Object.fromEntries(Object.entries(updates).map(([k, v]) => [k.replace(/[A-Z]/g, l => '_' + l.toLowerCase()), v]))
    const rows = await supa(c).pedir(`${TABELA}?id=eq.${encodeURIComponent(r.row.id)}&select=${COLUNAS}`, {
      method: 'PATCH',
      body: JSON.stringify(corpoDb),
    })
    return c.json({ ok: true, video: paraSaida(rows && rows[0]) })
  } catch (err) {
    return tratarErro(c, err)
  }
}

integracaoRouter.post('/videos-curtos/:id/status', mudarStatus)
integracaoRouter.patch('/videos-curtos/:id/status', mudarStatus)
