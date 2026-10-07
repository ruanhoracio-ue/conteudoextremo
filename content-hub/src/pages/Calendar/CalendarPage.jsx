import { useState, useMemo } from 'react'
import { useCollection, useApprovedItems } from '../../store/useStore'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select } from '../../components/ui/Input'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { ChevronLeft, ChevronRight, Plus, Calendar, Pencil, Trash2 } from 'lucide-react'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const FORMATOS = ['Carrossel', 'Reels', 'Estático', 'YouTube']
const STATUSES = ['Rascunho', 'Finalizado', 'Publicado']

const formatColors = {
  Carrossel: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  Reels: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
  Estático: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  YouTube: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
}

const statusTone = {
  Publicado: 'emerald',
  Finalizado: 'info',
  Rascunho: 'neutral',
}

const emptyPost = {
  agenda: '', formato: 'Reels', conteudo: '', conteudoRef: '', horario: '12:00', status: 'Rascunho',
}

export function CalendarPage() {
  const { items, addItem, updateItem, deleteItem } = useCollection('calendario')
  const approvedItems = useApprovedItems()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }
  function goToday() {
    setCurrentDate(new Date())
  }

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days = []

    // Previous month tail
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, inMonth: false, date: null })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, inMonth: true, date: dateStr })
    }

    // Next month head (fill to 42 cells = 6 rows)
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, inMonth: false, date: null })
    }

    return days
  }, [year, month])

  const postsByDate = useMemo(() => {
    const map = {}
    items.forEach(item => {
      if (!item.agenda) return
      if (!map[item.agenda]) map[item.agenda] = []
      map[item.agenda].push(item)
    })
    return map
  }, [items])

  const todayStr = new Date().toISOString().split('T')[0]

  const [dragOverDate, setDragOverDate] = useState(null)

  function handleDragStart(e, post) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: post.id, sourceDate: post.agenda }))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, dateStr) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(dateStr)
  }

  function handleDragLeave() {
    setDragOverDate(null)
  }

  function handleDrop(e, targetDate) {
    e.preventDefault()
    setDragOverDate(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (data.sourceDate !== targetDate) {
        updateItem(data.id, { agenda: targetDate })
        toast('Post movido para ' + targetDate)
      }
    } catch (err) {
      console.error('Drop error:', err)
    }
  }

  function openAdd(dateStr) {
    setEditing(null)
    setSelectedDate(dateStr)
    setModalOpen(true)
  }

  function openEdit(post) {
    setEditing(post)
    setSelectedDate(post.agenda)
    setModalOpen(true)
  }

  function handleSave(data) {
    if (editing) {
      updateItem(editing.id, data)
      toast('Post atualizado')
    } else {
      addItem(data)
      toast('Post agendado')
    }
    setModalOpen(false)
  }

  function handleDelete() {
    if (deleteTarget) {
      deleteItem(deleteTarget.id)
      toast('Post excluído')
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-lg text-ink">Calendário</h1>
          <p className="text-sm text-mute mt-1">Planeje e agende seu conteúdo no Instagram</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => openAdd(todayStr)} icon={<Plus size={16} />}>
          Novo Post
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-5 rounded-xl border border-hairline bg-surface p-3">
        <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-lg text-mute hover:bg-ink/5 hover:text-ink transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={goToday} className="px-3 py-1 rounded-full text-xs font-medium text-emerald-deep bg-emerald/10 hover:bg-emerald/20 transition-colors">
            Hoje
          </button>
        </div>
        <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg text-mute hover:bg-ink/5 hover:text-ink transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-hairline overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-elevated/50 border-b border-hairline">
          {DAYS.map(day => (
            <div key={day} className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-mute">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-hairline">
          {calendarDays.map((cell, idx) => {
            const posts = cell.date ? (postsByDate[cell.date] || []) : []
            const isToday = cell.date === todayStr

            return (
              <div
                key={idx}
                onClick={() => cell.inMonth && cell.date && posts.length === 0 && openAdd(cell.date)}
                onDragOver={e => cell.inMonth && cell.date && handleDragOver(e, cell.date)}
                onDragLeave={handleDragLeave}
                onDrop={e => cell.inMonth && cell.date && handleDrop(e, cell.date)}
                className={cn(
                  'calendar-day min-h-[110px] lg:min-h-[120px]',
                  !cell.inMonth && 'opacity-30',
                  isToday && 'today',
                  cell.inMonth && posts.length === 0 && 'cursor-pointer',
                  dragOverDate === cell.date && 'drag-over',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-xs font-medium',
                    isToday ? 'bg-emerald text-white h-6 w-6 flex items-center justify-center rounded-full' : 'text-mute',
                  )}>
                    {cell.day}
                  </span>
                  {cell.inMonth && cell.date && (
                    <button
                      onClick={e => { e.stopPropagation(); openAdd(cell.date) }}
                      className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-faint hover:text-emerald hover:bg-emerald/10 transition-all"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {posts.map(post => (
                    <button
                      key={post.id}
                      draggable
                      onDragStart={e => handleDragStart(e, post)}
                      onClick={e => { e.stopPropagation(); openEdit(post) }}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded-md text-[11px] font-medium border truncate transition-all hover:shadow-sm',
                        formatColors[post.formato] || 'bg-elevated text-body border-hairline',
                      )}
                      title={`${post.horario} · ${post.conteudo}`}
                    >
                      <span className="opacity-70">{post.horario}</span> {post.conteudo}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-mute">
        <span className="font-medium">Formatos:</span>
        {FORMATOS.map(f => (
          <span key={f} className={cn('px-2 py-0.5 rounded border text-[10px] font-medium', formatColors[f])}>
            {f}
          </span>
        ))}
      </div>

      {/* Post Form Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Post' : 'Novo Post'}>
        <PostForm
          initialData={editing}
          defaultDate={selectedDate}
          approvedItems={approvedItems}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          onDelete={editing ? () => { setDeleteTarget(editing); setModalOpen(false) } : null}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir post?"
        message={`"${deleteTarget?.conteudo}" será excluído do calendário.`}
      />
    </div>
  )
}

function PostForm({ initialData, defaultDate, approvedItems, onSave, onClose, onDelete }) {
  const [form, setForm] = useState(initialData || { ...emptyPost, agenda: defaultDate || '' })
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }))

  if (initialData && form.id !== initialData.id) setForm(initialData)

  function handleLinkApproved(e) {
    const selectedId = e.target.value
    if (!selectedId) {
      set('conteudoRef', '')
      return
    }
    const item = approvedItems.find(a => a.id === selectedId)
    if (item) {
      setForm(prev => ({ ...prev, conteudoRef: item.id, conteudo: item.title }))
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Data">
          <Input type="date" value={form.agenda} onChange={e => set('agenda', e.target.value)} required />
        </Field>
        <Field label="Horário">
          <Input type="time" value={form.horario} onChange={e => set('horario', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Formato">
          <Select value={form.formato} onChange={e => set('formato', e.target.value)}>
            {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Vincular conteúdo aprovado">
        <Select value={form.conteudoRef || ''} onChange={handleLinkApproved}>
          <option value="">Selecionar item aprovado (opcional)...</option>
          {approvedItems.map(item => (
            <option key={item.id} value={item.id}>[{item.type}] {item.title}</option>
          ))}
        </Select>
      </Field>

      <Field label="Conteúdo">
        <Input value={form.conteudo} onChange={e => set('conteudo', e.target.value)} placeholder="Descrição do post" required />
      </Field>

      <div className="flex items-center justify-between pt-4 border-t border-hairline">
        <div>
          {onDelete && (
            <Button variant="ghost" size="sm" type="button" onClick={onDelete} className="text-danger hover:text-danger">
              <Trash2 size={14} className="mr-1" /> Excluir
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" type="submit">{initialData ? 'Salvar' : 'Agendar'}</Button>
        </div>
      </div>
    </form>
  )
}
