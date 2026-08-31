import { useState, useMemo } from 'react'
import { useCollection } from '../../store/useStore'
import { Checkbox } from '../../components/ui/Checkbox'
import { Button } from '../../components/ui/Button'
import { SearchBar } from '../../components/ui/SearchBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { AttachmentsPanel } from '../../components/AttachmentsPanel'
import { Field, Input, Select } from '../../components/ui/Input'
import { toast } from '../../components/ui/Toast'
import { exportToCSV } from '../../store/storage'
import { AiButton } from '../../components/ai/AiPanel'
import { ClaudeButton } from '../../components/claude/ClaudePanel'
import { ScheduleModal } from '../../components/calendar/ScheduleModal'
import { Plus, Pencil, Trash2, LayoutGrid, Download } from 'lucide-react'
import { stageFilterOptions, matchesStageFilter } from '../../lib/stageFilter'

const STAGES = ['editado', 'aprovado', 'publicado']
const STAGE_LABELS = { editado: 'Editado', aprovado: 'Aprovado', publicado: 'Publicado' }

const emptyItem = {
  titulo: '', editado: false, aprovado: false, publicado: false,
}

export function CortesTab({ onNavigate }) {
  const { items, addItem, updateItem, deleteItem, toggleStage } = useCollection('cortes')
  const { addItem: addCalendarItem } = useCollection('calendario')

  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [scheduleTarget, setScheduleTarget] = useState(null)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return items.filter(item => {
      if (!matchesStageFilter(item, filterStage)) return false
      if (!search) return true
      return Boolean(item.titulo?.toLowerCase().includes(s))
    })
  }, [items, search, filterStage])

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setModalOpen(true) }

  function handleStageClick(item, stage) {
    const isBecomingApproved = stage === 'aprovado' && !item.aprovado
    toggleStage(item.id, stage, STAGES)

    if (isBecomingApproved) {
      setScheduleTarget({
        id: item.id,
        title: item.titulo,
        type: 'Carrossel',
        defaultFormat: 'Carrossel',
      })
    }
  }

  function handleSave(data) {
    let savedId = editing?.id
    const wasApprovedBefore = editing?.aprovado

    if (editing) {
      updateItem(editing.id, data)
      toast('Carrossel atualizado')
    } else {
      addItem(data)
      toast('Carrossel adicionado')
    }
    setModalOpen(false)

    if (data.aprovado && !wasApprovedBefore) {
      setScheduleTarget({
        id: savedId || 'new',
        title: data.titulo,
        type: 'Carrossel',
        defaultFormat: 'Carrossel',
      })
    }
  }

  function handleConfirmSchedule({ date, horario, formato }) {
    if (scheduleTarget) {
      addCalendarItem({
        agenda: date,
        horario,
        formato,
        conteudo: scheduleTarget.title,
        conteudoRef: scheduleTarget.id,
        status: 'Finalizado',
      })
      toast('Post agendado no calendário!')
      setScheduleTarget(null)
      if (onNavigate) onNavigate('calendario')
    }
  }

  function handleDelete() {
    if (deleteTarget) {
      deleteItem(deleteTarget.id)
      toast('Carrossel excluído')
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por título..." className="w-64" />
        <Select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-44 !h-10">
          <option value="">Todos os status</option>
          {stageFilterOptions(STAGES, STAGE_LABELS).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => exportToCSV(items, 'cortes')} icon={<Download size={14} />}>
          CSV
        </Button>
        <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>
          Novo Carrossel
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Nenhum carrossel encontrado" description="Adicione um novo carrossel ou ajuste a busca." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-elevated/50">
                {STAGES.map(s => (
                  <th key={s} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-mute w-20">
                    {STAGE_LABELS[s]}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Título</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-mute w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="border-b border-hairline-soft table-row-hover">
                  {STAGES.map(stage => (
                    <td key={stage} className="px-3 py-4 text-center">
                      <Checkbox checked={item[stage]} onChange={() => handleStageClick(item, stage)} />
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="text-left text-ink font-medium hover:text-emerald hover:underline underline-offset-2 transition-colors"
                        title="Abrir carrossel (editar e anexar arquivos)"
                      >
                        {item.titulo}
                      </button>
                    </div>
                    {item.observacao && <p className="text-xs text-mute mt-0.5">{item.observacao}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <ClaudeButton context={item} title="Claude — Carrossel" />
                      <AiButton context={item} title="IA — Carrossel" />
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-mute hover:text-ink hover:bg-ink/5 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-md text-mute hover:text-danger hover:bg-danger/5 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Carrossel' : 'Novo Carrossel'} size="lg">
        <CortesForm initialData={editing} onSave={handleSave} onClose={() => setModalOpen(false)} />
      </Modal>

      <ScheduleModal
        isOpen={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        item={scheduleTarget}
        onConfirm={handleConfirmSchedule}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir carrossel?"
        message={`"${deleteTarget?.titulo}" será excluído permanentemente.`}
      />
    </div>
  )
}

function CortesForm({ initialData, onSave, onClose }) {
  const [form, setForm] = useState(initialData || emptyItem)
  // id gerado já na criação, para permitir anexar arquivos antes de salvar
  const [draftId] = useState(() => crypto.randomUUID())
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }))

  if (initialData && form.id !== initialData.id) setForm(initialData)

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(initialData ? form : { ...form, id: draftId }) }} className="space-y-4">
      <Field label="Título">
        <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Título do carrossel" required />
      </Field>
      <div className="flex items-center gap-6 pt-2">
        {STAGES.map(s => <Checkbox key={s} checked={form[s]} onChange={v => set(s, v)} label={STAGE_LABELS[s]} />)}
      </div>
      <div className="pt-4 border-t border-hairline">
        <AttachmentsPanel itemType="cortes" itemId={initialData?.id || draftId} zipName={form.titulo} />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" type="submit">{initialData ? 'Salvar' : 'Adicionar'}</Button>
      </div>
    </form>
  )
}
