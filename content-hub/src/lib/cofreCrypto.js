// Criptografia do cofre de senhas — roda inteira no navegador (Web Crypto).
//
// Modelo:
//   - chave do cofre: 32 bytes aleatórios; cifra os dados com AES-256-GCM.
//   - senha mestra  -> PBKDF2-SHA256 (600 mil iterações) -> 64 bytes:
//       [0..32)  KEK  (chave que envelopa a chave do cofre)
//       [32..64) token de acesso, enviado à API no header X-Cofre-Auth
//   - chave de recuperação (20 bytes aleatórios) -> HKDF-SHA256 -> mesmos 64 bytes.
//   O servidor guarda só o SHA-256 dos tokens e os envelopes; nunca a senha,
//   nem a chave do cofre, nem os dados abertos.

const subtle = globalThis.crypto.subtle
const enc = new TextEncoder()
const dec = new TextDecoder()

export const ITERACOES = 600000
export const TAMANHO_RECUPERACAO = 20 // bytes -> 32 caracteres

export function bytesAleatorios(n) {
  const b = new Uint8Array(n)
  globalThis.crypto.getRandomValues(b)
  return b
}

export function paraBase64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function deBase64(str) {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function paraHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function importarKek(raw) {
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function dividir(bits) {
  const bytes = new Uint8Array(bits)
  return {
    kek: await importarKek(bytes.slice(0, 32)),
    token: paraBase64(bytes.slice(32, 64)),
  }
}

// Senha mestra -> { kek, token }
export async function derivarDaSenha(senha, saltBytes, iteracoes = ITERACOES) {
  const base = await subtle.importKey('raw', enc.encode(senha.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iteracoes },
    base, 512,
  )
  return dividir(bits)
}

// Chave de recuperação (bytes) -> { kek, token }
export async function derivarDaRecuperacao(chaveBytes, saltBytes) {
  const base = await subtle.importKey('raw', chaveBytes, 'HKDF', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: enc.encode('cofre-recuperacao-v1') },
    base, 512,
  )
  return dividir(bits)
}

export function gerarChaveCofre() {
  return bytesAleatorios(32)
}

export async function importarChaveCofre(bytes) {
  return subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function cifrarBytes(chave, bytes) {
  const iv = bytesAleatorios(12)
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, chave, bytes))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv, 0)
  out.set(ct, iv.length)
  return paraBase64(out)
}

async function decifrarBytes(chave, b64) {
  const all = deBase64(b64)
  const iv = all.slice(0, 12)
  const ct = all.slice(12)
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv }, chave, ct))
}

// Envelopa/desenvelopa a chave do cofre com uma KEK (senha mestra ou recuperação)
export function envelopar(kek, chaveCofreBytes) {
  return cifrarBytes(kek, chaveCofreBytes)
}

export function desenvelopar(kek, envelopeB64) {
  return decifrarBytes(kek, envelopeB64)
}

// Dados do cofre (objeto/array) <-> ciphertext base64
export async function cifrar(chaveCofre, obj) {
  return cifrarBytes(chaveCofre, enc.encode(JSON.stringify(obj)))
}

export async function decifrar(chaveCofre, b64) {
  return JSON.parse(dec.decode(await decifrarBytes(chaveCofre, b64)))
}

// O servidor guarda SHA-256(token); o navegador manda o token em si.
export async function hashToken(token) {
  return paraHex(new Uint8Array(await subtle.digest('SHA-256', enc.encode(token))))
}

// ---- chave de recuperação legível: base32 Crockford, 8 grupos de 4 ----
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function formatarChaveRecuperacao(bytes) {
  let bits = 0, valor = 0, out = ''
  for (const b of bytes) {
    valor = (valor << 8) | b
    bits += 8
    while (bits >= 5) {
      out += ALFABETO[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALFABETO[(valor << (5 - bits)) & 31]
  return out.match(/.{1,4}/g).join('-')
}

export function lerChaveRecuperacao(texto) {
  const limpo = (texto || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1').replace(/O/g, '0')
  const esperado = Math.ceil((TAMANHO_RECUPERACAO * 8) / 5)
  if (limpo.length !== esperado) return null
  let bits = 0, valor = 0
  const out = []
  for (const ch of limpo) {
    const idx = ALFABETO.indexOf(ch)
    if (idx < 0) return null
    valor = (valor << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out.slice(0, TAMANHO_RECUPERACAO))
}
