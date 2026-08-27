// Filtro por etapa nas tabelas de Organização.
//
// As etapas (gravado / editado / aprovado / publicado) são booleanos no item,
// então cada uma vira duas opções de filtro: já feita e ainda não feita.
// É o que permite, por exemplo, esconder os Reels já publicados escolhendo
// "Não publicado".
//
// O valor do filtro é uma string "<modo>:<etapa>", ou '' para não filtrar.

export function stageFilterOptions(stages, labels) {
  return stages.flatMap(stage => {
    const label = labels[stage] || stage
    return [
      { value: `feito:${stage}`, label },
      { value: `pendente:${stage}`, label: `Não ${label.toLowerCase()}` },
    ]
  })
}

export function matchesStageFilter(item, filterValue) {
  if (!filterValue) return true

  const [mode, stage] = filterValue.split(':')
  if (!stage) return true

  const done = Boolean(item[stage])
  if (mode === 'feito') return done
  if (mode === 'pendente') return !done
  return true
}
