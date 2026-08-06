import { Hono } from 'hono'

// Porta de server/routes/auth.js para Hono + Cloudflare KV.
// Antes: usuários gravados em /tmp/content_hub_users_db.json (efêmero).
// Agora: persistidos em KV sob a chave `users` (binding CONTENT_HUB_KV).
export const authRouter = new Hono()

const USERS_KEY = 'users'

const INITIAL_USERS = [
  {
    id: 'user-ruan-horacio',
    name: 'Ruan Horacio',
    email: 'ruuanhoraciio@gmail.com',
    password: 'admin',
    role: 'admin',
    status: 'approved',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'user-augusto-canarin',
    name: 'Augusto Canarin',
    email: 'augustocanaring@gmail.com',
    password: 'admin',
    role: 'admin',
    status: 'approved',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
]

function kvOf(env) {
  return env && env.CONTENT_HUB_KV ? env.CONTENT_HUB_KV : null
}

async function getUsers(env) {
  const kv = kvOf(env)
  if (kv) {
    try {
      const raw = await kv.get(USERS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (err) {
      console.error('Error reading users from KV:', err)
    }
  }
  return INITIAL_USERS
}

async function setUsers(env, users) {
  const kv = kvOf(env)
  if (!kv) {
    console.warn('CONTENT_HUB_KV não está vinculado — usuários não serão persistidos')
    return
  }
  try {
    await kv.put(USERS_KEY, JSON.stringify(users))
  } catch (err) {
    console.error('Error saving users to KV:', err)
  }
}

function genId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// GET /api/auth/users
authRouter.get('/users', async (c) => {
  return c.json({ users: await getUsers(c.env) })
})

// POST /api/auth/register
authRouter.post('/register', async (c) => {
  const { name, email, password } = await c.req.json().catch(() => ({}))
  if (!email || !password || !name) {
    return c.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, 400)
  }

  const users = await getUsers(c.env)
  const normalizedEmail = email.trim().toLowerCase()

  const existing = users.find(u => u.email.toLowerCase() === normalizedEmail)
  if (existing) {
    return c.json({ error: 'Já existe uma conta cadastrada com este e-mail.' }, 400)
  }

  // TODO NOVO CADASTRO ENTRA COMO PENDENTE (VISUALIZADOR)
  const newUser = {
    id: genId(),
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: 'visualizador',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  const updated = [...users, newUser]
  await setUsers(c.env, updated)

  return c.json({ user: newUser, isPending: true })
})

// POST /api/auth/login
authRouter.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}))
  if (!email || !password) {
    return c.json({ error: 'E-mail e senha são obrigatórios.' }, 400)
  }

  const users = await getUsers(c.env)
  const normalizedEmail = email.trim().toLowerCase()

  const user = users.find(u => u.email.toLowerCase() === normalizedEmail)
  if (!user) {
    return c.json({ error: 'E-mail ou senha incorretos.' }, 401)
  }

  if (user.password !== password) {
    return c.json({ error: 'E-mail ou senha incorretos.' }, 401)
  }

  if (user.status === 'pending') {
    return c.json({ isPending: true, user })
  }

  if (user.status === 'rejected') {
    return c.json({ error: 'Sua solicitação de acesso foi recusada pelo administrador.' }, 403)
  }

  return c.json({ isPending: false, user })
})

// POST /api/auth/admin/create-user
authRouter.post('/admin/create-user', async (c) => {
  const { name, email, password, role } = await c.req.json().catch(() => ({}))
  if (!email || !password || !name) {
    return c.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, 400)
  }

  const users = await getUsers(c.env)
  const normalizedEmail = email.trim().toLowerCase()

  const existing = users.find(u => u.email.toLowerCase() === normalizedEmail)
  if (existing) {
    return c.json({ error: 'Já existe uma conta com este e-mail.' }, 400)
  }

  const newUser = {
    id: genId(),
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: role || 'editor',
    status: 'approved',
    createdAt: new Date().toISOString(),
  }

  const updated = [...users, newUser]
  await setUsers(c.env, updated)

  return c.json({ user: newUser, users: updated })
})

// POST /api/auth/admin/approve
authRouter.post('/admin/approve', async (c) => {
  const { userId } = await c.req.json().catch(() => ({}))
  const users = await getUsers(c.env)
  const updated = users.map(u => (u.id === userId ? { ...u, status: 'approved' } : u))
  await setUsers(c.env, updated)
  return c.json({ users: updated })
})

// POST /api/auth/admin/reject
authRouter.post('/admin/reject', async (c) => {
  const { userId } = await c.req.json().catch(() => ({}))
  const users = await getUsers(c.env)
  const updated = users.map(u => (u.id === userId ? { ...u, status: 'rejected' } : u))
  await setUsers(c.env, updated)
  return c.json({ users: updated })
})

// POST /api/auth/admin/role
authRouter.post('/admin/role', async (c) => {
  const { userId, newRole } = await c.req.json().catch(() => ({}))
  const users = await getUsers(c.env)
  const updated = users.map(u => (u.id === userId ? { ...u, role: newRole } : u))
  await setUsers(c.env, updated)
  return c.json({ users: updated })
})

// POST /api/auth/admin/delete
authRouter.post('/admin/delete', async (c) => {
  const { userId } = await c.req.json().catch(() => ({}))
  const users = await getUsers(c.env)
  const updated = users.filter(u => u.id !== userId)
  await setUsers(c.env, updated)
  return c.json({ users: updated })
})
