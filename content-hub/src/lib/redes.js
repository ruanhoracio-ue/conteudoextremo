// Sub-abas de rede social dos Vídeos Curtos (TikTok e Shorts).
//
// Não existe uma lista separada: as sub-abas mostram os mesmos vídeos da lista
// principal, filtrados para os que já estão aprovados ou publicados. Cada rede
// tem só um controle próprio, o booleano "postado" (postado_tiktok /
// postado_shorts no banco). Por isso, assim que um vídeo é aprovado na lista
// principal, ele aparece nas duas sub-abas sem nenhum passo manual.

export const REDES_VIDEOS_CURTOS = [
  { key: 'tiktok', label: 'TikTok', campo: 'postadoTiktok' },
  { key: 'shorts', label: 'Shorts', campo: 'postadoShorts' },
]

// Entra nas sub-abas quem já passou pela aprovação na lista principal.
export function elegivelParaRedes(item) {
  return Boolean(item?.aprovado || item?.publicado)
}

// Filtro das sub-abas: '' (todos), 'postados' ou 'pendentes'.
export const OPCOES_FILTRO_POSTADO = [
  { value: '', label: 'Todos' },
  { value: 'pendentes', label: 'Não postados' },
  { value: 'postados', label: 'Postados' },
]

export function matchesPostadoFilter(item, campo, filtro) {
  if (!filtro) return true
  const postado = Boolean(item[campo])
  return filtro === 'postados' ? postado : !postado
}

// Resumo para o cabeçalho da sub-aba: quantos elegíveis e quantos já postados.
export function contarRede(itens, campo) {
  const elegiveis = itens.filter(elegivelParaRedes)
  return { total: elegiveis.length, postados: elegiveis.filter(i => i[campo]).length }
}
