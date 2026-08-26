import { useState, useEffect } from 'react'

// Preferência de exibição da coluna "Link" nas tabelas de Organização
// (Vídeos Curtos, Cortes, Vídeos Longos). Fica escondida por padrão? Não:
// mantém o comportamento atual (visível) e lembra a escolha do usuário
// neste navegador. Os uploads passaram a ser feitos dentro do app, então
// a coluna virou opcional.
const STORAGE_KEY = 'content_hub_show_link_column'

export function useLinkColumn() {
  const [showLink, setShowLink] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(showLink))
    } catch (e) {
      console.error('Erro ao salvar preferência da coluna Link:', e)
    }
  }, [showLink])

  const toggleLink = () => setShowLink(v => !v)

  return { showLink, toggleLink }
}
