// Cliente da API do cofre de senhas (/api/cofre, ver cf/routes/cofre.js).

export class CofreConflito extends Error {
  constructor(atual) {
    super('O cofre foi alterado por outra pessoa.')
    this.name = 'CofreConflito'
    this.atual = atual
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

export async function carregarCofre() {
  const res = await fetch('/api/cofre')
  if (!res.ok) throw new Error(await lerErro(res))
  return res.json()
}

// Envia a versão lida; o servidor recusa com 409 se alguém salvou antes.
export async function salvarCofre(versao, itens) {
  const res = await fetch('/api/cofre', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versao, itens }),
  })
  if (res.status === 409) throw new CofreConflito(await res.json())
  if (!res.ok) throw new Error(await lerErro(res))
  return res.json()
}

// Gera uma senha forte usando o gerador criptográfico do navegador.
export function gerarSenha(tamanho = 20) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const numeros = '23456789'
  const simbolos = '!@#$%&*?-_+='
  const tudo = letras + numeros + simbolos

  const sorteia = (conjunto) => conjunto[crypto.getRandomValues(new Uint32Array(1))[0] % conjunto.length]

  // garante pelo menos uma letra, um número e um símbolo
  const base = [sorteia(letras), sorteia(numeros), sorteia(simbolos)]
  while (base.length < tamanho) base.push(sorteia(tudo))

  // embaralha (Fisher-Yates) para os obrigatórios não ficarem sempre no início
  for (let i = base.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  return base.join('')
}
