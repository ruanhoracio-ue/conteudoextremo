// Cliente da API do cofre (/api/cofre, ver cf/routes/cofre.js).
// Todas as rotas autenticadas mandam o token derivado da senha mestra (ou da
// chave de recuperação) no header X-Cofre-Auth. O servidor só conhece o hash.

export class CofreConflito extends Error {
  constructor(atual) {
    super('O cofre foi alterado por outra pessoa.')
    this.name = 'CofreConflito'
    this.atual = atual
  }
}

export class CofreNaoAutorizado extends Error {
  constructor() {
    super('Senha incorreta.')
    this.name = 'CofreNaoAutorizado'
  }
}

async function lerErro(res) {
  try {
    const data = await res.json()
    return data.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

async function chamar(caminho, { token, method = 'GET', body } = {}) {
  const headers = { 'Cache-Control': 'no-store' }
  if (token) headers['X-Cofre-Auth'] = token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api/cofre${caminho}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (res.status === 401) throw new CofreNaoAutorizado()
  if (res.status === 409 && caminho === '' && method === 'PUT') throw new CofreConflito(await res.json())
  if (!res.ok) throw new Error(await lerErro(res))
  return res.json()
}

export const obterStatus = () => chamar('/status')
export const configurarCofre = (payload) => chamar('/configurar', { method: 'POST', body: payload })
export const carregarCofre = (token) => chamar('', { token })
export const salvarCofre = (token, versao, dados) => chamar('', { token, method: 'PUT', body: { versao, dados } })
export const obterVersaoAnterior = (token, versao) => chamar(`/historico/${versao}`, { token })
export const trocarSenhaMestra = (token, mestra) => chamar('/senha-mestra', { token, method: 'POST', body: { mestra } })

// Gera uma senha forte usando o gerador criptográfico do navegador.
export function gerarSenha(tamanho = 20) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const numeros = '23456789'
  const simbolos = '!@#$%&*?-_+='
  const tudo = letras + numeros + simbolos

  const sorteia = (conjunto) => conjunto[crypto.getRandomValues(new Uint32Array(1))[0] % conjunto.length]

  const base = [sorteia(letras), sorteia(numeros), sorteia(simbolos)]
  while (base.length < tamanho) base.push(sorteia(tudo))

  for (let i = base.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  return base.join('')
}
