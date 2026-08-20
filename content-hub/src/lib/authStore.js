/**
 * Auth & RBAC Manager for Content Hub
 * Roles: 'admin' | 'editor' | 'visualizador'
 * Status: 'approved' | 'pending' | 'rejected'
 * Users persisted in Supabase (single source of truth) with localStorage session cache.
 */

import {
  isSupabaseConfigured,
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  seedUsers,
} from './supabase'

const AUTH_USERS_KEY = 'content_hub_auth_users_v2'
const AUTH_SESSION_KEY = 'content_hub_auth_session_v2'

export function getLocalSession() {
  try {
    const data = localStorage.getItem(AUTH_SESSION_KEY)
    if (data) return JSON.parse(data)
  } catch (e) {
    console.error('Error reading local session:', e)
  }
  return null
}

export function saveLocalSession(user) {
  try {
    if (user) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY)
    }
  } catch (e) {
    console.error('Error saving local session:', e)
  }
}

export const INITIAL_USERS = [
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

export function getLocalUsers() {
  try {
    const data = localStorage.getItem(AUTH_USERS_KEY)
    if (data) return JSON.parse(data)
  } catch (e) {
    console.error('Error reading local users:', e)
  }
  return INITIAL_USERS
}

export function saveLocalUsers(users) {
  try {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users))
  } catch (e) {
    console.error('Error saving local users:', e)
  }
}

function normalizeUser(raw) {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    password: raw.password,
    role: raw.role || 'visualizador',
    status: raw.status || 'pending',
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

export async function fetchUsersList() {
  if (isSupabaseConfigured) {
    const users = await fetchUsers()
    if (users) {
      if (users.length === 0) {
        await seedUsers(INITIAL_USERS)
        const seeded = await fetchUsers()
        if (seeded) {
          saveLocalUsers(seeded)
          return seeded
        }
      }
      saveLocalUsers(users)
      return users
    }
  }
  // Fallback to local
  return getLocalUsers()
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase()

  if (isSupabaseConfigured) {
    const existing = await fetchUsers()
    if (existing && existing.some(u => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.')
    }

    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'visualizador',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    const created = await createUser(newUser)
    if (created) {
      const currentList = getLocalUsers()
      saveLocalUsers([...currentList.filter(u => u.id !== created.id), created])
      return created
    }
  }

  // Fallback local logic if Supabase is unreachable
  const users = getLocalUsers()
  const existing = users.find(u => u.email.toLowerCase() === normalizedEmail)
  if (existing) {
    throw new Error('Já existe uma conta cadastrada com este e-mail.')
  }

  const localUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: 'visualizador',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  saveLocalUsers([...users, localUser])
  return localUser
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase()

  let user = null

  if (isSupabaseConfigured) {
    const users = await fetchUsers()
    user = users ? users.find(u => u.email.toLowerCase() === normalizedEmail) : null
  }

  if (!user) {
    const users = getLocalUsers()
    user = users.find(u => u.email.toLowerCase() === normalizedEmail) || null
  }

  if (!user || user.password !== password) {
    throw new Error('E-mail ou senha incorretos.')
  }

  if (user.status === 'pending') {
    return { isPending: true, user }
  }
  if (user.status === 'rejected') {
    throw new Error('Sua solicitação de acesso foi recusada pelo administrador.')
  }

  saveLocalSession(user)
  return { isPending: false, user }
}

export function logoutUser() {
  saveLocalSession(null)
}

export async function adminApproveUser(userId) {
  if (isSupabaseConfigured) {
    const updated = await updateUser(userId, { status: 'approved' })
    if (updated) {
      const list = await fetchUsersList()
      return list
    }
  }

  const users = getLocalUsers()
  const updated = users.map(u => u.id === userId ? { ...u, status: 'approved' } : u)
  saveLocalUsers(updated)
  return updated
}

export async function adminRejectUser(userId) {
  if (isSupabaseConfigured) {
    const updated = await updateUser(userId, { status: 'rejected' })
    if (updated) {
      const list = await fetchUsersList()
      return list
    }
  }

  const users = getLocalUsers()
  const updated = users.map(u => u.id === userId ? { ...u, status: 'rejected' } : u)
  saveLocalUsers(updated)
  return updated
}

export async function adminChangeRole(userId, newRole) {
  if (isSupabaseConfigured) {
    const updated = await updateUser(userId, { role: newRole })
    if (updated) {
      const list = await fetchUsersList()
      return list
    }
  }

  const users = getLocalUsers()
  const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u)
  saveLocalUsers(updated)
  return updated
}

export async function adminChangeName(userId, newName) {
  const trimmed = (newName || '').trim()
  if (!trimmed) {
    throw new Error('O nome de usuário não pode ficar vazio.')
  }

  if (isSupabaseConfigured) {
    const updated = await updateUser(userId, { name: trimmed })
    if (updated) {
      const list = await fetchUsersList()
      return list
    }
  }

  const users = getLocalUsers()
  const updated = users.map(u => u.id === userId ? { ...u, name: trimmed } : u)
  saveLocalUsers(updated)
  return updated
}

export async function adminCreateUser({ name, email, password, role }) {
  const normalizedEmail = email.trim().toLowerCase()

  if (isSupabaseConfigured) {
    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role || 'editor',
      status: 'approved',
      createdAt: new Date().toISOString(),
    }

    const created = await createUser(newUser)
    if (created) {
      const list = await fetchUsersList()
      return list.find(u => u.id === created.id)
    }
  }

  const users = getLocalUsers()
  const existing = users.find(u => u.email.toLowerCase() === normalizedEmail)
  if (existing) {
    throw new Error('Já existe uma conta com este e-mail.')
  }

  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: role || 'editor',
    status: 'approved',
    createdAt: new Date().toISOString(),
  }

  const updated = [...users, newUser]
  saveLocalUsers(updated)
  return newUser
}

export async function adminDeleteUser(userId) {
  if (isSupabaseConfigured) {
    const ok = await deleteUser(userId)
    if (ok) {
      const list = await fetchUsersList()
      return list
    }
  }

  const users = getLocalUsers()
  const updated = users.filter(u => u.id !== userId)
  saveLocalUsers(updated)
  return updated
}
