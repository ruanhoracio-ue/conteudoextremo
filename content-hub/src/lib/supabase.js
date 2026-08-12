import { createClient } from '@supabase/supabase-js'

// Valores públicos do projeto Supabase como fallback (a chave publishable é
// pública por design — protegida por RLS no servidor). Assim o build funciona
// sem precisar configurar variáveis de ambiente. Para apontar para outro
// projeto, defina VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (elas têm prioridade).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jtbcdnoiwocgfunckvvz.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_nCZQXm9MY_33E3NoHiw_7A_xVJMkWVD'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null

const TABLES = {
  videosLongos: 'videos_longos',
  videosCurtos: 'videos_curtos',
  cortes: 'cortes',
  frases: 'frases',
  equipe: 'equipe',
  calendario: 'calendario',
  producao: 'producao',
  criativos: 'criativos',
  usuarios: 'usuarios',
}

// Tables whose id is defined by the client (text primary key)
const CLIENT_ID_TABLES = new Set(['criativos', 'usuarios'])

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, l => '_' + l.toLowerCase())
}

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
}

function mapKeys(obj, fn) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(i => mapKeys(i, fn))
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    result[fn(k)] = v
  }
  return result
}

export function itemToDb(item, name) {
  const db = mapKeys(item, camelToSnake)
  // Mantém o id quando fornecido (permite gerar o id no cliente antes de
  // salvar — necessário para anexar arquivos a itens ainda não salvos).
  // Sem id, as tabelas uuid continuam gerando via gen_random_uuid().
  if (!CLIENT_ID_TABLES.has(name) && !db.id) {
    delete db.id
  }
  delete db.created_at
  delete db.updated_at
  return db
}

export function itemFromDb(row) {
  const item = mapKeys(row, snakeToCamel)
  if (item.createdAt) item.createdAt = new Date(item.createdAt).toISOString()
  if (item.updatedAt) item.updatedAt = new Date(item.updatedAt).toISOString()
  return item
}

function arrayFromDb(rows) {
  return (rows || []).map(itemFromDb)
}

export async function loadCollection(name) {
  const table = TABLES[name]
  if (!table || !supabase) return []

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`Error loading ${name}:`, error)
    return []
  }

  return arrayFromDb(data)
}

export async function addItem(name, item) {
  const table = TABLES[name]
  if (!table || !supabase) return null

  const dbItem = {
    ...itemToDb(item, name),
    created_at: item.createdAt || new Date().toISOString(),
  }
  if (name !== 'criativos' && name !== 'usuarios') {
    dbItem.updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(table)
    .insert([dbItem])
    .select()
    .single()

  if (error) {
    console.error(`Error adding to ${name}:`, error)
    return null
  }

  return itemFromDb(data)
}

export async function updateItem(name, id, updates) {
  const table = TABLES[name]
  if (!table || !supabase) return null

  const dbUpdates = itemToDb(updates, name)
  if (name !== 'criativos' && name !== 'usuarios') {
    dbUpdates.updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(table)
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error(`Error updating ${name}:`, error)
    return null
  }

  return itemFromDb(data)
}

export async function deleteItem(name, id) {
  const table = TABLES[name]
  if (!table || !supabase) return false

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)

  if (error) {
    console.error(`Error deleting from ${name}:`, error)
    return false
  }

  return true
}

export async function replaceCollection(name, items) {
  const table = TABLES[name]
  if (!table || !supabase) return false

  const { error: delError } = await supabase.from(table).delete().gt('created_at', '1970-01-01T00:00:00Z')
  if (delError) {
    console.error(`Error clearing ${name}:`, delError)
    return false
  }

  if (!items || items.length === 0) return true

  const rows = items.map(item => {
    const row = {
      ...itemToDb(item, name),
      created_at: item.createdAt || new Date().toISOString(),
    }
    if (name !== 'criativos' && name !== 'usuarios') {
      row.updated_at = new Date().toISOString()
    }
    return row
  })

  const { error: insError } = await supabase.from(table).insert(rows)
  if (insError) {
    console.error(`Error replacing ${name}:`, insError)
    return false
  }

  return true
}

// ---------- Usuarios (auth & RBAC) ----------

export async function fetchUsers() {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error loading usuarios:', error)
    return null
  }

  return arrayFromDb(data)
}

export async function createUser(user) {
  if (!supabase) return null

  const dbUser = {
    ...itemToDb(user, 'usuarios'),
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert([dbUser])
    .select()
    .single()

  if (error) {
    console.error('Error creating user:', error)
    return null
  }

  return itemFromDb(data)
}

export async function updateUser(id, updates) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('usuarios')
    .update(itemToDb(updates, 'usuarios'))
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating user:', error)
    return null
  }

  return itemFromDb(data)
}

export async function deleteUser(id) {
  if (!supabase) return false

  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting user:', error)
    return false
  }

  return true
}

export async function seedUsers(users) {
  if (!supabase || !users || users.length === 0) return

  const current = await fetchUsers()
  if (current.length > 0) return

  for (const user of users) {
    await createUser(user)
  }
}
