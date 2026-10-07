import { statusOf } from './stageStatus.js'

// Ordenação das tabelas de Organização (lógica pura, sem React — o hook que
// guarda a escolha por aba está em useOrdenacao.js).

export const OPCOES_ORDEM = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'status', label: 'Status' },
  { value: 'alfabetica', label: 'A–Z' },
  { value: 'atualizados', label: 'Atualizados há pouco' },
]

const ts = (v) => (v ? new Date(v).getTime() || 0 : 0)
const maisRecente = (a, b) => ts(b.createdAt) - ts(a.createdAt)

// Devolve uma cópia ordenada; nunca muda a lista original.
//   stages: etapas da aba, na ordem do fluxo (para o modo "status")
//   titulo: campo usado no modo "A–Z" (tema nos longos, titulo nos demais)
export function ordenar(itens, modo, { stages, titulo = 'titulo' }) {
  const lista = [...itens]
  switch (modo) {
    case 'status':
      // o que ainda precisa de trabalho vem primeiro: Fila (-1), depois cada etapa na ordem do fluxo
      return lista.sort((a, b) => {
        const d = stages.indexOf(statusOf(a, stages)) - stages.indexOf(statusOf(b, stages))
        return d !== 0 ? d : maisRecente(a, b)
      })
    case 'alfabetica':
      return lista.sort((a, b) => (a[titulo] || '').localeCompare(b[titulo] || '', 'pt-BR', { sensitivity: 'base' }))
    case 'atualizados':
      return lista.sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt) || maisRecente(a, b))
    case 'recentes':
    default:
      return lista.sort(maisRecente)
  }
}
