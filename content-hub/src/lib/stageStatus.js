// Status único derivado das etapas booleanas das abas de Organização.
//
// As etapas já eram sequenciais: marcar "aprovado" ligava as anteriores e
// desmarcar desligava as seguintes (ver toggleStage no store). Este módulo só
// dá a essa mesma regra a forma de um status, para a tabela mostrar uma
// pílula em vez de várias caixinhas — sem nenhuma coluna nova no banco.
//
// O status é a etapa mais avançada já concluída; nenhuma concluída = "Fila".

export const FILA = ''

export function statusOf(item, stages) {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (item[stages[i]]) return stages[i]
  }
  return FILA
}

// Escolher uma etapa liga tudo até ela e desliga o que vem depois.
export function updatesForStatus(stages, target) {
  const idx = target ? stages.indexOf(target) : -1
  const updates = {}
  stages.forEach((stage, i) => { updates[stage] = i <= idx })
  return updates
}
