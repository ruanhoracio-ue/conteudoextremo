// Status único derivado das etapas booleanas das abas de Organização.
//
// As etapas são sequenciais: escolher uma liga tudo até ela e desliga o que
// vem depois (a mesma regra que o toggleStage aplicava às caixinhas). Este
// módulo dá a essa regra a forma de um status, para a tabela mostrar uma
// pílula em vez de várias caixinhas.
//
// Etapas "laterais" (hoje só "alteracao" — o item voltou da aprovação com
// ajustes) não fazem parte do caminho feliz: nenhuma etapa posterior as
// implica, e voltar para uma etapa anterior as limpa. Assim "Aprovado" não
// marca "alteracao" por tabela, e reenviar para aprovação apaga a marca.
//
// O status é a etapa mais avançada já concluída; nenhuma concluída = "Fila".

export const FILA = ''
export const LATERAL = new Set(['alteracao'])

export function statusOf(item, stages) {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (item[stages[i]]) return stages[i]
  }
  return FILA
}

export function updatesForStatus(stages, target) {
  const idx = target ? stages.indexOf(target) : -1
  const updates = {}
  stages.forEach((stage, i) => {
    if (i === idx) updates[stage] = true
    else if (i > idx) updates[stage] = false
    else if (!LATERAL.has(stage)) updates[stage] = true
    // lateral anterior ao alvo: fica como está (histórico de que houve ajustes)
  })
  return updates
}
