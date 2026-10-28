import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { paraInputLocal, deInputLocal } from '../lib/agendamento'

// Abre quando alguém marca "Agendado" na tabela: pede a data agendada e,
// se já tiver, o link do post. Confirmar aplica o status e os campos juntos;
// cancelar não muda nada.
export function AgendamentoModal({ item, isOpen, onClose, onConfirm, titulo }) {
  const [data, setData] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => {
    if (isOpen) {
      setData(paraInputLocal(item?.dataAgendada))
      setLink(item?.linkPost || '')
    }
  }, [isOpen, item])

  if (!item) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agendar publicação" size="sm">
      <form
        onSubmit={e => { e.preventDefault(); onConfirm({ dataAgendada: deInputLocal(data), linkPost: link.trim() }) }}
        className="space-y-4"
      >
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Agendado</p>
          <p className="text-sm text-ink">{titulo}</p>
        </div>
        <Field label="Data e hora agendadas">
          <Input autoFocus type="datetime-local" value={data} onChange={e => setData(e.target.value)} required />
        </Field>
        <Field label="Link do post (opcional)">
          <Input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
        </Field>
        <div className="flex justify-end gap-3 border-t border-hairline pt-4">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" type="submit">Marcar Agendado</Button>
        </div>
      </form>
    </Modal>
  )
}
