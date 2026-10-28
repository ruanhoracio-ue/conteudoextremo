// Status "Agendado" dos Vídeos Curtos: data agendada e link do post.
// Lógica pura (sem React), usada pela aba, pelo modal e pela API de integração.

export const STAGES_VIDEOS_CURTOS = ['editado', 'emAprovacao', 'alteracao', 'aprovado', 'agendado', 'publicado']

// Validação de datas vindas de fora (API, input). Devolve ISO ou null.
export function normalizarDataAgendada(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const t = typeof valor === 'string' || typeof valor === 'number' ? Date.parse(valor) : NaN
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

const dois = (n) => String(n).padStart(2, '0')

// ISO -> valor de <input type="datetime-local"> (horário local do navegador)
export function paraInputLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`
}

// valor do <input type="datetime-local"> -> ISO (ou '' se vazio/inválido)
export function deInputLocal(valor) {
  if (!valor) return ''
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

// "28/10/2026, 14:00" para mostrar na tabela
export function formatarDataAgendada(iso, locale = 'pt-BR') {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

// Link do post: só http(s), sem espaços. Devolve a string limpa ou null se inválido.
export function normalizarLinkPost(valor) {
  if (valor === null || valor === undefined) return ''
  const s = String(valor).trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null
  } catch {
    return null
  }
}
