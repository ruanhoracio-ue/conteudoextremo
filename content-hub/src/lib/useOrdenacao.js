import { useState, useEffect } from 'react'
import { OPCOES_ORDEM } from './ordenacao.js'

// A escolha de ordenação fica salva por aba no navegador (mesmo padrão da
// coluna Link), porque é preferência de leitura, não um filtro momentâneo.
const PREFIX = 'content_hub_ordem'
const PADRAO = 'recentes'

export function useOrdenacao(scope) {
  const storageKey = `${PREFIX}:${scope}`
  const [ordem, setOrdem] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey)
      return OPCOES_ORDEM.some(o => o.value === v) ? v : PADRAO
    } catch {
      return PADRAO
    }
  })
  useEffect(() => {
    try { localStorage.setItem(storageKey, ordem) } catch { /* sem localStorage: segue em memória */ }
  }, [storageKey, ordem])
  return [ordem, setOrdem]
}

