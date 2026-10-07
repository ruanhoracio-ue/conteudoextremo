import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Input'
import { Calendar, ArrowRight } from 'lucide-react'

const FORMATOS = ['Reels', 'Carrossel', 'Estático', 'YouTube']

export function ScheduleModal({ isOpen, onClose, item, onConfirm }) {
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const [date, setDate] = useState(tomorrowStr)
  const [horario, setHorario] = useState('12:00')
  const [formato, setFormato] = useState('Reels')

  useEffect(() => {
    if (isOpen) {
      setDate(tomorrowStr)
      if (item?.defaultFormat) {
        setFormato(item.defaultFormat)
      }
    }
  }, [isOpen, item])

  if (!item) return null

  function handleSubmit(e) {
    e.preventDefault()
    onConfirm({ date, horario, formato })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✨ Conteúdo Aprovado! Agendar no Calendário" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3.5 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-deep dark:text-emerald-400">
            {item.type}
          </p>
          <p className="text-sm font-medium text-ink mt-0.5">{item.title}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data de Publicação">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </Field>
          <Field label="Horário">
            <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} required />
          </Field>
        </div>

        <Field label="Formato de Postagem">
          <Select value={formato} onChange={e => setFormato(e.target.value)}>
            {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Field>

        <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Apenas Aprovar (Sem Agendar)
          </Button>
          <Button variant="brand" size="sm" type="submit" icon={<ArrowRight size={16} />}>
            Agendar e Ir pro Calendário
          </Button>
        </div>
      </form>
    </Modal>
  )
}
