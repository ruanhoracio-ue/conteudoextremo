import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Textarea } from './ui/Input'

// Abre quando alguém marca "Alteração" na tabela: pede o que precisa mudar,
// para quem for editar saber direto pelo sistema. Confirmar aplica o status e
// a nota juntos; cancelar não muda nada.
export function AlteracaoNotaModal({ item, isOpen, onClose, onConfirm, titulo }) {
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (isOpen) setNota(item?.alteracaoNota || '')
  }, [isOpen, item])

  if (!item) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="O que precisa mudar?" size="sm">
      <form onSubmit={e => { e.preventDefault(); onConfirm(nota.trim()) }} className="space-y-4">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Alteração</p>
          <p className="text-sm text-ink">{titulo}</p>
        </div>
        <Field label="Anotações para quem vai editar">
          <Textarea
            autoFocus
            rows={4}
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Ex.: cortar a introdução, trocar a legenda em 1:20, subir o volume da música..."
          />
        </Field>
        <p className="text-xs text-mute">A nota fica visível na tabela, embaixo do título, enquanto o item estiver em Alteração.</p>
        <div className="flex justify-end gap-3 border-t border-hairline pt-4">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" type="submit">Marcar Alteração</Button>
        </div>
      </form>
    </Modal>
  )
}
