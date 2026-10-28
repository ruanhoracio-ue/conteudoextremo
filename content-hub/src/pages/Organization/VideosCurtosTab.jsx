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
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { AlteracaoNotaModal } from '../../components/AlteracaoNotaModal'
import { toast } from '../../components/ui/Toast'
import { UploadButton } from '../../components/ui/UploadButton'
import { AttachmentsPanel } from '../../components/AttachmentsPanel'
import { exportToCSV } from '../../store/storage'
import { cn } from '../../lib/cn'
import { AiButton } from '../../components/ai/AiPanel'
import { ClaudeButton } from '../../components/claude/ClaudePanel'
import { ScheduleModal } from '../../components/calendar/ScheduleModal'
import { Plus, Pencil, Trash2, ExternalLink, AlertCircle, Film, Download, Eye, EyeOff, CalendarClock, Copy } from 'lucide-react'
import { useLinkColumn } from '../../lib/useLinkColumn'
import { stageFilterOptions, matchesStageFilter } from '../../lib/stageFilter'
import { ordenar, OPCOES_ORDEM } from '../../lib/ordenacao'
import { useOrdenacao } from '../../lib/useOrdenacao'
import { PostadoToggle } from '../../components/ui/PostadoToggle'
import { REDES_VIDEOS_CURTOS, elegivelParaRedes, OPCOES_FILTRO_POSTADO, matchesPostadoFilter, contarRede } from '../../lib/redes'
import { AgendamentoModal } from '../../components/AgendamentoModal'
import { STAGES_VIDEOS_CURTOS, formatarDataAgendada, paraInputLocal, deInputLocal } from '../../lib/agendamento'

// Fluxo sem o "Agendado" (Vídeos Tiago): a tabela videos_tiago não tem as colunas do agendamento.
const STAGES_BASE = ['editado', 'emAprovacao', 'alteracao', 'aprovado', 'publicado']
const STAGE_LABELS = { editado: 'Editado', emAprovacao: 'Em Aprovação', alteracao: 'Alteração', aprovado: 'Aprovado', agendado: 'Agendado', publicado: 'Publicado' }
const CATEGORIAS = ['Lo-fi', 'Corte', 'Claude', 'Tiago', 'Tutorial', 'Dica']

function itemVazio(stages) {
  const base = { categoria: '', titulo: '', linkFinalizado: '', alteracaoNota: '' }
  stages.forEach(s => { base[s] = false })
  if (stages.includes('agendado')) Object.assign(base, { dataAgendada: '', linkPost: '' })
  return base
}

async function copiarId(id) {
  try {
    await navigator.clipboard.writeText(id)
    toast('ID copiado')
  } catch {
    window.prompt('Copie o ID:', id)
  }
}

// A aba é reaproveitada por outras listas com o mesmo fluxo (ex.: Vídeos Tiago):
// basta passar um config com a coleção e os rótulos.
export const CONFIG_VIDEOS_CURTOS = {
  collection: 'videosCurtos',      // chave no store / TABLES
  scope: 'videos-curtos',          // preferências salvas por aba (coluna Link, ordenação)
  tipo: 'Vídeo Curto',             // rótulo singular (modais, Claude/IA, calendário)
  novo: 'Novo Vídeo Curto',        // botão de criar
  csv: 'videos-curtos',            // nome do arquivo exportado
  attachmentsType: 'videosCurtos', // pasta dos anexos no R2
  vazioTitulo: 'Nenhum vídeo curto encontrado',
  vazioDescricao: 'Adicione um novo vídeo curto ou ajuste os filtros.',
  // sub-abas de rede social (TikTok / Shorts); [] desliga. Ver lib/redes.js
  redes: REDES_VIDEOS_CURTOS,
  // etapas do fluxo, na ordem; com 'agendado' a aba ganha data agendada + link do post
  stages: STAGES_VIDEOS_CURTOS,
}

export function VideosCurtosTab({ onNavigate, config }) {
  const cfg = { ...CONFIG_VIDEOS_CURTOS, ...(config || {}) }
  const STAGES = cfg.stages || STAGES_BASE
  const temAgendamento = STAGES.includes('agendado')
  const { items, addItem, updateItem, deleteItem } = useCollection(cfg.collection)
  const { addItem: addCalendarItem } = useCollection('calendario')

  const [search, setSearch] = useState('')
  const { showLink, toggleLink } = useLinkColumn(cfg.scope)
  const [filterCat, setFilterCat] = useState('')
  const [filterStage, setFilterStage] = useState('')
  // '' = lista principal; 'tiktok' / 'shorts' = sub-aba da rede
  const [rede, setRede] = useState('')
  const [filterPostado, setFilterPostado] = useState('')
  const redeAtual = cfg.redes.find(r => r.key === rede) || null
  const [ordem, setOrdem] = useOrdenacao(cfg.scope)
  const [notaTarget, setNotaTarget] = useState(null)
  const [agendarTarget, setAgendarTarget] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [scheduleTarget, setScheduleTarget] = useState(null)

  const categorias = useMemo(() => [...new Set(items.map(i => i.categoria).filter(Boolean))], [items])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterCat && item.categoria !== filterCat) return false
      if (redeAtual) {
        // a sub-aba só mostra quem já foi aprovado/publicado na lista principal
        if (!elegivelParaRedes(item)) return false
        if (!matchesPostadoFilter(item, redeAtual.campo, filterPostado)) return false
      } else if (!matchesStageFilter(item, filterStage)) {
        return false
      }
      if (search) {
        const q = search.trim().toLowerCase()
        const bateTitulo = item.titulo?.toLowerCase().includes(q)
        const bateId = q.length >= 4 && String(item.id || '').toLowerCase().startsWith(q)
        if (!bateTitulo && !bateId) return false
      }
      return true
    })
  }, [items, search, filterCat, filterStage, redeAtual, filterPostado])

  // na sub-aba, "ordenar por status" = não postados primeiro
  const ordenados = useMemo(
    () => ordenar(filtered, ordem, { stages: redeAtual ? [redeAtual.campo] : STAGES, titulo: 'titulo' }),
    [filtered, ordem, redeAtual, STAGES],
  )

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setModalOpen(true) }

  function handleStatusChange(item, status) {
    // Alteração pede o que mudar antes de aplicar; o modal confirma status + nota juntos.
    if (status === 'alteracao') { setNotaTarget(item); return }
    // Agendado pede a data (e o link do post, se já tiver) antes de aplicar.
    if (status === 'agendado') { setAgendarTarget(item); return }
    const updates = updatesForStatus(STAGES, status)
    const virouAprovado = updates.aprovado && !item.aprovado
    updateItem(item.id, updates)

    if (virouAprovado) {
      setScheduleTarget({
        id: item.id,
        title: item.titulo,
        type: cfg.tipo,
        defaultFormat: 'Reels',
      })
    }
  }

  function handleConfirmarAgendamento({ dataAgendada, linkPost }) {
    if (!agendarTarget) return
    updateItem(agendarTarget.id, { ...updatesForStatus(STAGES, 'agendado'), dataAgendada: dataAgendada || null, linkPost })
    setAgendarTarget(null)
  }

  function handleConfirmarAlteracao(nota) {
    if (!notaTarget) return
    updateItem(notaTarget.id, { ...updatesForStatus(STAGES, 'alteracao'), alteracaoNota: nota })
    setNotaTarget(null)
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
        type: cfg.tipo,
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
      {cfg.redes.length > 0 && (
        <div role="tablist" aria-label="Lista" className="mb-5 inline-flex items-center gap-1 rounded-xl border border-hairline bg-elevated/50 p-1">
          {[{ key: '', label: 'Principal' }, ...cfg.redes].map(r => {
            const ativo = rede === r.key
            const contagem = r.campo ? contarRede(items, r.campo) : null
            return (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setRede(r.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                  ativo ? 'bg-surface text-ink shadow-sm' : 'text-mute hover:text-ink',
                )}
              >
                {r.label}
                {contagem && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                      contagem.total > 0 && contagem.postados === contagem.total
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-ink/5 text-mute',
                    )}
                    title={`${contagem.postados} de ${contagem.total} postados no ${r.label}`}
                  >
                    {contagem.postados}/{contagem.total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por título..." className="w-64" />
        <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="w-48 !h-10">
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        {redeAtual ? (
          <Select value={filterPostado} onChange={e => setFilterPostado(e.target.value)} className="w-48 !h-10">
            {OPCOES_FILTRO_POSTADO.map(o => (
              <option key={o.value} value={o.value}>{o.value ? `${o.label} no ${redeAtual.label}` : `Todos (${redeAtual.label})`}</option>
            ))}
          </Select>
        ) : (
          <Select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-48 !h-10">
            <option value="">Todos os status</option>
            {stageFilterOptions(STAGES, STAGE_LABELS).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        )}
        <Select value={ordem} onChange={e => setOrdem(e.target.value)} className="w-64 !h-10" title="Ordenar por">
          {OPCOES_ORDEM.map(o => <option key={o.value} value={o.value}>Ordenar: {o.label}</option>)}
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
        <Button variant="ghost" size="sm" onClick={() => exportToCSV(items, cfg.csv)} icon={<Download size={14} />}>
          CSV
        </Button>
        {!redeAtual && (
          <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>
            {cfg.novo}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        redeAtual && !search && !filterCat && !filterPostado ? (
          <EmptyState
            icon={Film}
            title={`Nada para o ${redeAtual.label} por enquanto`}
            description="Os vídeos entram aqui sozinhos assim que ficarem aprovados ou publicados na lista Principal."
          />
        ) : (
          <EmptyState icon={Film} title={cfg.vazioTitulo} description={cfg.vazioDescricao} />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-elevated/50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute w-32">{redeAtual ? redeAtual.label : 'Status'}</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Categoria</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute">Título</th>
                {showLink && (
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-mute w-24">Link</th>
                )}
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-mute w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map(item => (
                <tr key={item.id} className={cn(
                  'border-b border-hairline-soft table-row-hover',
                  isPending(item) && 'bg-amber-50/30 dark:bg-amber-950/10',
                )}>
                  <td className="px-4 py-4">
                    {redeAtual ? (
                      <PostadoToggle
                        postado={Boolean(item[redeAtual.campo])}
                        rede={redeAtual.label}
                        onChange={(v) => updateItem(item.id, { [redeAtual.campo]: v })}
                      />
                    ) : (
                      <StageStatusSelect
                        item={item}
                        stages={STAGES}
                        labels={STAGE_LABELS}
                        onChange={(status) => handleStatusChange(item, status)}
                      />
                    )}
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
                    {item.alteracao && item.alteracaoNota && (
                      <p className="mt-0.5 max-w-xs truncate text-[11px] text-rose-600 dark:text-rose-400" title={item.alteracaoNota}>
                        ⚠ {item.alteracaoNota}
                      </p>
                    )}
                    {temAgendamento && item.agendado && (item.dataAgendada || item.linkPost) && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400">
                        <CalendarClock size={12} className="shrink-0" />
                        {item.dataAgendada && <span>{formatarDataAgendada(item.dataAgendada)}</span>}
                        {item.linkPost && (
                          <a href={item.linkPost} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300">
                            ver post
                          </a>
                        )}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => copiarId(item.id)}
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-faint hover:text-ink transition-colors"
                      title={`ID completo: ${item.id} (clique para copiar)`}
                    >
                      <Copy size={9} className="shrink-0" />
                      {String(item.id).slice(0, 8)}
                    </button>
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
                      <ClaudeButton context={item} title={`Claude — ${cfg.tipo}`} />
                      <AiButton context={item} title={`IA — ${cfg.tipo}`} />
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Editar ${cfg.tipo}` : cfg.novo}>
        <VideosCurtosForm
          attachmentsType={cfg.attachmentsType}
          redes={cfg.redes}
          stages={STAGES}
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

      <AgendamentoModal
        item={agendarTarget}
        isOpen={!!agendarTarget}
        onClose={() => setAgendarTarget(null)}
        onConfirm={handleConfirmarAgendamento}
        titulo={agendarTarget?.titulo}
      />

      <AlteracaoNotaModal
        item={notaTarget}
        isOpen={!!notaTarget}
        onClose={() => setNotaTarget(null)}
        onConfirm={handleConfirmarAlteracao}
        titulo={notaTarget?.titulo}
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

function VideosCurtosForm({ initialData, onSave, onClose, attachmentsType, redes = [], stages = STAGES_BASE }) {
  const STAGES = stages
  const temAgendamento = STAGES.includes('agendado')
  // os campos "postado" só existem nas listas com sub-abas de rede (não em Vídeos Tiago)
  const [form, setForm] = useState(initialData || { ...itemVazio(STAGES), ...Object.fromEntries(redes.map(r => [r.campo, false])) })
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
        {STAGES.map(s => <Checkbox key={s} checked={form[s]} onChange={v => set(s, v)} label={STAGE_LABELS[s]} />)}
      </div>
      {temAgendamento && (form.agendado || form.publicado) && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data agendada">
            <Input type="datetime-local" value={paraInputLocal(form.dataAgendada)} onChange={e => set('dataAgendada', deInputLocal(e.target.value) || null)} />
          </Field>
          <Field label="Link do post">
            <Input type="url" value={form.linkPost || ''} onChange={e => set('linkPost', e.target.value)} placeholder="https://..." />
          </Field>
        </div>
      )}
      {redes.length > 0 && (form.aprovado || form.publicado) && (
        <div className="flex items-center gap-6">
          {redes.map(r => (
            <Checkbox key={r.key} checked={Boolean(form[r.campo])} onChange={v => set(r.campo, v)} label={`Postado no ${r.label}`} />
          ))}
        </div>
      )}
      {form.alteracao && (
        <Field label="O que precisa mudar">
          <Textarea rows={3} value={form.alteracaoNota || ''} onChange={e => set('alteracaoNota', e.target.value)} placeholder="Anotações para quem vai editar..." />
        </Field>
      )}
      <div className="pt-4 border-t border-hairline">
        <AttachmentsPanel itemType={attachmentsType} itemId={initialData?.id || draftId} />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" type="submit">{initialData ? 'Salvar' : 'Adicionar'}</Button>
      </div>
    </form>
  )
}
