import { Hono } from 'hono'

// Porta de server/routes/data.js para Hono + Cloudflare KV.
// Antes: store global em /tmp/content_hub_global_store.json (efêmero).
// Agora: persistido em KV sob a chave `global_store`.
export const dataRouter = new Hono()

const STORE_KEY = 'global_store'
const COLLECTIONS = ['criativos', 'videosLongos', 'videosCurtos', 'cortes', 'frases', 'calendario']

function emptyStore() {
  return {
    criativos: [],
    videosLongos: [],
    videosCurtos: [],
    cortes: [],
    frases: [],
    calendario: [],
    updatedAt: new Date().toISOString(),
  }
}

async function loadStore(env) {
  const kv = env && env.CONTENT_HUB_KV
  if (kv) {
    try {
      const raw = await kv.get(STORE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data && typeof data === 'object') {
          const store = emptyStore()
          for (const key of COLLECTIONS) {
            if (Array.isArray(data[key])) store[key] = data[key]
          }
          if (data.updatedAt) store.updatedAt = data.updatedAt
          return store
        }
      }
    } catch (err) {
      console.error('Error loading global data store from KV:', err)
    }
  }
  return emptyStore()
}

async function saveStore(env, store) {
  const kv = env && env.CONTENT_HUB_KV
  if (!kv) {
    console.warn('CONTENT_HUB_KV não está vinculado — dados não serão persistidos')
    return
  }
  try {
    await kv.put(STORE_KEY, JSON.stringify(store))
  } catch (err) {
    console.error('Error saving global data store to KV:', err)
  }
}

// GET /api/data - Retorna todos os dados sincronizados
dataRouter.get('/', async (c) => {
  const store = await loadStore(c.env)
  return c.json({ success: true, data: store })
})

// POST /api/data - Salva os dados sincronizados
dataRouter.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const store = await loadStore(c.env)

    for (const key of COLLECTIONS) {
      if (Array.isArray(body[key])) store[key] = body[key]
    }

    store.updatedAt = new Date().toISOString()
    await saveStore(c.env, store)

    return c.json({ success: true, data: store })
  } catch (err) {
    console.error('Error updating global data store:', err)
    return c.json({ success: false, error: err.message }, 500)
  }
})
