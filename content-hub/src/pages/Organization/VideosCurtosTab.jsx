import { useState, useMemo } from 'react'
import { useCollection } from '../../store/useStore'
import { Checkbox } from '../../components/ui/Checkbox'
import { StageStatusSelect } from '../../components/ui/StageStatusSelect'
import { updatesForStatus } from '../../lib/stageStatus'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SearchBar } from '../../components/ui/SearchBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select } from '../../components/ui/Input'
import { toast } from '../../components/ui/Toast'
import { UploadButton } from '../../components/ui/UploadButton'
import { AttachmentsPanel } from '../../components/AttachmentsPanel'
import { exportToCSV } from '../../store/storage'
import { cn } from '../../lib/cn'
import { AiButton } from '../../components/ai/AiPanel'
import { ClaudeButton } from '../../components/claude/ClaudePanel'
import { ScheduleModal } from '../../components/calendar/ScheduleModal'
import { Plus, Pencil, Trash2, ExternalLink, AlertCircle, Film, Download, Eye, EyeOff } from 'lucide-react'
import { useLinkColumn } from '../../lib/useLinkColumn'
import { stageFilterOptions, matchesStageFilter } from '../../lib/stageFilter'

const STAGES = ['editado', 'aprovado', 'publicado']
const STAGE_LABELS = { editado: 'Editado', aprovado: 'Aprovado', publicado: 'Publicado' }
const CATEGORIAS = ['Lo-fi', 'Corte', 'Claude', 'Tiago', 'Tutorial', 'Dica']

const emptyItem = {
  editado: false, aprovado: false, publicado: false,
  categoria: '', titulo: '', linkFinalizado: '',
}

export function VideosCurtosTab({ onNavigate }) {
  const { items, addItem, updateItem, deleteItem } = useCollection('videosCurtos')
  const { addItem: addCalendarItem } = useCollection('calendario')

  const [search, setSearch] = useState('')
  const { showLink, toggleLink } = useLinkColumn('videos-curtos')
  const [filterCat, setFilterCat] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [scheduleTarget, setScheduleTarget] = useState(null)

  const categorias = useMemo(() => [...new Set(items.map(i => i.categoria).filter(Boolean))], [items])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterCat && item.categoria !== filterCat) return false
      if (!matchesStageFilter(item, filterStage)) return false
      if (search && !item.titulo?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [items, search, filterCat, filterStage])

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setModalOpen(true) }

  function handleStatusChange(item, status) {
    const updates = updatesForStatus(STAGES, status)
    const virouAprovado = updates.aprovado && !item.aprovado
    updateItem(item.id, updates)

    if (virouAprovado) {
      setScheduleTarget({
        id: item.id,
        title: item.titulo,
        type: 'Vídeo Curto',
        defaultFormat: 'Reels',
      })
    }
  }

  function handleSave(data) {
    let savedId = editing?.id
    const wasApprovedBefore = editing?.aprovado

    if (editing) {
      updateItem(editing.id, data)
      toast('Vídeo curto atualizado')
    } else {
      addItem(data)
      toast('Vídeo curto adicionado')
    }
    setModalOpen(false)

    if (data.aprovado && !wasApprovedBefore) {
      setScheduleTarget({
        id: savedId || 'new',
        title: data.titulo,
        type: 'Vídeo Curto',
        defaultFormat: 'Reels',
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
      toast('Vídeo curto excluído')
      setDeleteTarget(null)
    }
  }

  const isPending = (item) => item.aprovado && !item.linkFinalizado

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por título..." className="w-64" />
        <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="w-40 !h-10">
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-44 !h-10">
          <option value="">Todos os status</option>
          {stageFilterOptions(STAGES, STAGE_LABELS).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLink}
          icon={showLink ? <EyeOff size={14} /> : <Eye size={14} />}
          title={showLink ? 'Ocultar a coluna Link da tabela' : 'Mostrar a coluna Link na tabela'}
        >
          {showLink ? 'Ocultar Link' : 'Mostrar Link'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => exportToCSV(items, 'videos-curtos')} icon={<Download size={14} />}>
          CSV
        </Button>
        <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>
          Novo Vídeo Curto
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Film} title="Nenhum vídeo curto encontrado" description="Adicione um novo vídeo curto ou ajuste os filtros." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-elevated/50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute w-32">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Categoria</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Título</th>
                {showLink && (
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute w-24">Link</th>
                )}
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-mute w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className={cn(
                  'border-b border-hairline-soft table-row-hover',
                  isPending(item) && 'bg-amber-50/30 dark:bg-amber-950/10',
                )}>
                  <td className="px-4 py-4">
                    <StageStatusSelect
                      item={item}
                      stages={STAGES}
                      labels={STAGE_LABELS}
                      onChange={(status) => handleStatusChange(item, status)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    {item.categoria && <Badge tone="soft">{item.categoria}</Badge>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="text-left text-ink font-medium hover:text-emerald hover:underline underline-offset-2 transition-colors"
                        title="Abrir vídeo (editar e anexar arquivos)"
                      >
                        {item.titulo}
                      </button>
                      {isPending(item) && (
                        <span title="Aprovado sem link finalizado" className="pending-pulse">
                          <AlertCircle size={14} className="text-warning" />
                        </span>
                      )}
                    </div>
                  </td>
                  {showLink && (
                    <td className="px-4 py-4">
                      {item.linkFinalizado ? (
                        <a
                          href={item.linkFinalizado}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald hover:text-emerald-deep underline underline-offset-2 transition-colors max-w-[200px] truncate"
                        >
                          <ExternalLink size={12} className="shrink-0" />
                          <span className="truncate">{item.linkFinalizado.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : <span className="text-faint">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <ClaudeButton context={item} title="Claude — Vídeo Curto" />
                      <AiButton context={item} title="IA — Vídeo Curto" />
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Vídeo Curto' : 'Novo Vídeo Curto'}>
        <VideosCurtosForm
          initialData={editing}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
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
        title="Excluir vídeo curto?"
        message={`"${deleteTarget?.titulo}" será excluído permanentemente.`}
      />
    </div>
  )
}

function VideosCurtosForm({ initialData, onSave, onClose }) {
  const [form, setForm] = useState(initialData || emptyItem)
  // id gerado já na criação, para permitir anexos antes de salvar
  const [draftId] = useState(() => crypto.randomUUID())
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }))

  if (initialData && form.id !== initialData.id) setForm(initialData)

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(initialData ? form : { ...form, id: draftId }) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoria">
          <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Link Finalizado">
          <div className="flex items-center gap-2">
            <Input value={form.linkFinalizado} onChange={e => set('linkFinalizado', e.target.value)} placeholder="https://... ou clique em Subir" />
            <UploadButton onUploaded={url => set('linkFinalizado', url)} onError={() => toast('Falha no upload. Tente novamente.')} />
          </div>
        </Field>
      </div>
      <Field label="Título">
        <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Título do vídeo curto" required />
      </Field>
      <div className="flex items-center gap-6 pt-2">
        {STAGES.map(s => <Checkbox key={s} checked={form[s]} onChange={v => set(s, v)} label={STAGE_LABELS[s]} />)}
      </div>
      <div className="pt-4 border-t border-hairline">
        <AttachmentsPanel itemType="videosCurtos" itemId={initialData?.id || draftId} />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" type="submit">{initialData ? 'Salvar' : 'Adicionar'}</Button>
      </div>
    </form>
  )
}
