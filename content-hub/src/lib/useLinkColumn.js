import { useState, useEffect } from 'react'

// Preferência de exibição da coluna "Link" nas tabelas de Organização.
// Cada aba (Vídeos Curtos, Carrossel, Vídeos Longos) guarda a sua própria
// escolha, por isso a chave recebe um escopo. Os uploads passaram a ser
// feitos dentro do app, então a coluna virou opcional — mas o padrão
// continua sendo visível, para não esconder nada sem o usuário pedir.
const PREFIX = 'content_hub_show_link_column'

export function useLinkColumn(scope) {
  const storageKey = `${PREFIX}:${scope}`

  const [showLink, setShowLink] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(showLink))
    } catch (e) {
      console.error('Erro ao salvar preferência da coluna Link:', e)
    }
  }, [storageKey, showLink])

  const toggleLink = () => setShowLink(v => !v)

  return { showLink, toggleLink }
}
