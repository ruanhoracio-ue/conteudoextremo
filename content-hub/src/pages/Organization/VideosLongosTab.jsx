import { useState, useMemo } from 'react'
import { useCollection } from '../../store/useStore'
import { Checkbox } from '../../components/ui/Checkbox'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SearchBar } from '../../components/ui/SearchBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { toast } from '../../components/ui/Toast'
import { UploadButton } from '../../components/ui/UploadButton'
import { AttachmentsPanel } from '../../components/AttachmentsPanel'
import { exportToCSV } from '../../store/storage'
import { cn } from '../../lib/cn'
import { AiButton } from '../../components/ai/AiPanel'
import { ClaudeButton } from '../../components/claude/ClaudePanel'
import { ScheduleModal } from '../../components/calendar/ScheduleModal'
import { Plus, Pencil, Trash2, ExternalLink, AlertCircle, Video, Download } from 'lucide-react'

const STAGES = ['gravado', 'editado', 'aprovado', 'publicado']
const STAGE_LABELS = { gravado: 'Gravado', editado: 'Editado', aprovado: 'Aprovado', publicado: 'Publicado' }
const CATEGORIAS = ['Aula', 'Vlog', 'React', 'Collab', 'Entrevista', 'Review']

const emptyItem = {
  gravado: false, editado: false, aprovado: false, publicado: false,
  categoria: '', ondeQuem: '', tema: '', linkFinalizado: '', thumb: '', descricao: '',
}

export function VideosLongosTab({ onNavigate }) {
  const { items, addItem, updateItem, deleteItem, toggleStage } = useCollection('videosLongos')
  const { addItem: addCalendarItem } = useCollection('calendario')

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterQuem, setFilterQuem] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [scheduleTarget, setScheduleTarget] = useState(null)

  const categorias = useMemo(() => [...new Set(items.map(i => i.categoria).filter(Boolean))], [items])
  const quemList = useMemo(() => [...new Set(items.map(i => i.ondeQuem).filter(Boolean))], [items])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterCat && item.categoria !== filterCat) return false
      if (filterQuem && item.ondeQuem !== filterQuem) return false
      if (search) {
        const s = search.toLowerCase()
        if (!item.tema?.toLowerCase().includes(s) && !item.descricao?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [items, search, filterCat, filterQuem])

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setModalOpen(true) }

  function handleStageClick(item, stage) {
    const isBecomingApproved = stage === 'aprovado' && !item.aprovado
    toggleStage(item.id, stage, STAGES)

    if (isBecomingApproved) {
      setScheduleTarget({
        id: item.id,
        title: item.tema,
        type: 'Vídeo Longo',
        defaultFormat: 'Reels',
      })
    }
  }

  function handleSave(data) {
    let savedId = editing?.id
    const wasApprovedBefore = editing?.aprovado

    if (editing) {
      updateItem(editing.id, data)
      toast('Vídeo atualizado')
    } else {
      addItem(data)
      toast('Vídeo adicionado')
    }
    setModalOpen(false)

    if (data.aprovado && !wasApprovedBefore) {
      setScheduleTarget({
        id: savedId || 'new',
        title: data.tema,
        type: 'Vídeo Longo',
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
      toast('Vídeo excluído')
      setDeleteTarget(null)
    }
  }

  const isPending = (item) => item.aprovado && !item.linkFinalizado

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por tema..." className="w-64" />
        <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="w-40 !h-10">
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filterQuem} onChange={e => setFilterQuem(e.target.value)} className="w-40 !h-10">
          <option value="">Todos Onde/Quem</option>
          {quemList.map(q => <option key={q} value={q}>{q}</option>)}
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => exportToCSV(items, 'videos-longos')} icon={<Download size={14} />}>
          CSV
        </Button>
        <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>
          Novo Vídeo
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Video} title="Nenhum vídeo encontrado" description="Adicione um novo vídeo longo ou ajuste os filtros." />
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
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Categoria</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Onde/Quem</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Tema</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute w-24">Link</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-mute w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className={cn(
                  'border-b border-hairline-soft table-row-hover',
                  isPending(item) && 'bg-amber-50/30 dark:bg-amber-950/10',
                )}>
                  {STAGES.map(stage => (
                    <td key={stage} className="px-3 py-4 text-center">
                      <Checkbox
                        checked={item[stage]}
                        onChange={() => handleStageClick(item, stage)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    {item.categoria && <Badge tone="soft">{item.categoria}</Badge>}
                  </td>
                  <td className="px-4 py-4 text-body">{item.ondeQuem}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="text-left text-ink font-medium hover:text-emerald hover:underline underline-offset-2 transition-colors"
                        title="Abrir vídeo (editar e anexar arquivos)"
                      >
                        {item.tema}
                      </button>
                      {isPending(item) && (
                        <span title="Aprovado sem link finalizado" className="pending-pulse">
                          <AlertCircle size={14} className="text-warning" />
                        </span>
                      )}
                    </div>
                    {item.descricao && <p className="text-xs text-mute mt-0.5 truncate max-w-xs">{item.descricao}</p>}
                  </td>
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
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <ClaudeButton context={item} title="Claude — Vídeo Longo" />
                      <AiButton context={item} title="IA — Vídeo Longo" />
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

      {/* Form Modal */}
      <VideoLongoForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editing}
      />

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        item={scheduleTarget}
        onConfirm={handleConfirmSchedule}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir vídeo?"
        message={`"${deleteTarget?.tema}" será excluído permanentemente.`}
      />
    </div>
  )
}

function VideoLongoForm({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm] = useState(initialData || emptyItem)

  useState(() => {
    setForm(initialData || emptyItem)
  }, [initialData])

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  function handleSubmit(e) {
    e.preventDefault()
    onSave(form)
    setForm(emptyItem)
  }

  if (isOpen && initialData && form.id !== initialData.id) {
    setForm(initialData)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Vídeo Longo' : 'Novo Vídeo Longo'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria">
            <Select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">Selecione...</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Onde/Quem">
            <Input value={form.ondeQuem} onChange={e => set('ondeQuem', e.target.value)} placeholder="YouTube, Hotmart, Lucão..." />
          </Field>
        </div>
        <Field label="Tema">
          <Input value={form.tema} onChange={e => set('tema', e.target.value)} placeholder="Título ou tema do vídeo" required />
        </Field>
        <Field label="Descrição">
          <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Descrição breve..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Link Finalizado">
            <div className="flex items-center gap-2">
              <Input value={form.linkFinalizado} onChange={e => set('linkFinalizado', e.target.value)} placeholder="https://... ou Subir" />
              <UploadButton onUploaded={url => set('linkFinalizado', url)} onError={() => toast('Falha no upload. Tente novamente.')} />
            </div>
          </Field>
          <Field label="Thumbnail">
            <div className="flex items-center gap-2">
              <Input value={form.thumb} onChange={e => set('thumb', e.target.value)} placeholder="URL ou Subir" />
              <UploadButton accept="image/*" onUploaded={url => set('thumb', url)} onError={() => toast('Falha no upload. Tente novamente.')} />
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-6 pt-2">
          {STAGES.map(s => (
            <Checkbox key={s} checked={form[s]} onChange={v => set(s, v)} label={STAGE_LABELS[s]} />
          ))}
        </div>
        {initialData?.id ? (
          <div className="pt-4 border-t border-hairline">
            <AttachmentsPanel itemType="videosLongos" itemId={initialData.id} />
          </div>
        ) : (
          <p className="pt-2 text-[11px] text-faint">Salve o vídeo para poder anexar arquivos a ele.</p>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" type="submit">{initialData ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
