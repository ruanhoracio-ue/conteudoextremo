import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search, Filter, Plus, FileSpreadsheet, Download, ExternalLink,
  CheckCircle2, Clock, PlayCircle, Users, Trash2, Edit3, Folder, FileVideo,
  Copy, Check, Eye
} from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { useSpotlight } from '../../lib/useSpotlight'
import { ImportCriativosSheetModal } from '../../components/ImportCriativosSheetModal'
import { Button } from '../../components/ui/Button'
import { AttachmentsPanel } from '../../components/AttachmentsPanel'
import { toast } from '../../components/ui/Toast'
import { exportToCSV } from '../../store/storage'
import {
  loadCollection,
  addItem as addToSupabase,
  updateItem as updateInSupabase,
  deleteItem as deleteFromSupabase,
  replaceCollection,
} from '../../lib/supabase'

export function CriativosPage() {
  const { canEdit, isVisualizador } = useAuth()

  // Load state from Supabase (single source of truth)
  const [criativos, setCriativos] = useState([])
  const [loaded, setLoaded] = useState(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const items = await loadCollection('criativos')
      if (mounted) {
        setCriativos(items || [])
        setLoaded(true)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Real-time sync across devices (skips while a local change is pending)
  useEffect(() => {
    if (!loaded) return
    const interval = setInterval(async () => {
      if (dirtyRef.current) return
      const cloud = await loadCollection('criativos')
      setCriativos(prev => {
        const cloudJson = JSON.stringify(cloud)
        const localJson = JSON.stringify(prev)
        if (cloudJson !== localJson && Array.isArray(cloud)) return cloud
        return prev
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [loaded])

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [editorFilter, setEditorFilter] = useState('Todos')
  const [gravacaoFilter, setGravacaoFilter] = useState('Todos')

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  // id gerado ao abrir "Novo Criativo", para permitir anexos antes de salvar
  const [draftId, setDraftId] = useState(null)

  // Copy feedback state
  const [copiedId, setCopiedId] = useState(null)

  // Form State for Single Item Add/Edit
  const [formData, setFormData] = useState({
    status: 'Fila',
    editor: '',
    gravacao: '',
    tag: '',
    nomeArquivo: '',
    linkPastaBase: '',
    arquivoFinalizado: '',
  })

  // Unique values for filter dropdowns
  const availableEditors = useMemo(() => {
    const set = new Set()
    criativos.forEach(c => { if (c.editor) set.add(c.editor) })
    return Array.from(set)
  }, [criativos])

  const availableGravacoes = useMemo(() => {
    const set = new Set()
    criativos.forEach(c => { if (c.gravacao) set.add(c.gravacao) })
    return Array.from(set)
  }, [criativos])

  // Filtered Criativos List
  const filteredCriativos = useMemo(() => {
    return criativos.filter(item => {
      const matchesSearch =
        item.nomeArquivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.gravacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.editor && item.editor.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'Todos' || item.status === statusFilter
      const matchesEditor = editorFilter === 'Todos' || (editorFilter === 'Sem Editor' ? !item.editor : item.editor === editorFilter)
      const matchesGravacao = gravacaoFilter === 'Todos' || item.gravacao === gravacaoFilter

      return matchesSearch && matchesStatus && matchesEditor && matchesGravacao
    })
  }, [criativos, searchTerm, statusFilter, editorFilter, gravacaoFilter])

  // KPI Calculations
  const totalCount = criativos.length
  const finalizadosCount = criativos.filter(c => c.status === 'Finalizado').length
  const filaCount = criativos.filter(c => c.status === 'Fila').length
  const emEdicaoCount = criativos.filter(c => c.status === 'Em Edição').length
  const percentFinalizado = totalCount > 0 ? Math.round((finalizadosCount / totalCount) * 100) : 0

  // Operations
  const handleImport = async (newItems, mode) => {
    dirtyRef.current = true
    try {
      if (mode === 'replace') {
        setCriativos(newItems)
        await replaceCollection('criativos', newItems)
      } else {
        setCriativos(prev => [...newItems, ...prev])
        await Promise.all(newItems.map(item => addToSupabase('criativos', item)))
      }
    } catch (err) {
      console.error('Erro ao importar criativos:', err)
    } finally {
      dirtyRef.current = false
    }
  }

  const handleInlineStatusChange = async (id, newStatus) => {
    dirtyRef.current = true
    setCriativos(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
    try {
      await updateInSupabase('criativos', id, { status: newStatus })
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    } finally {
      dirtyRef.current = false
    }
  }

  const handleInlineTagChange = async (id, newTag) => {
    dirtyRef.current = true
    setCriativos(prev => prev.map(c => c.id === id ? { ...c, tag: newTag } : c))
    try {
      await updateInSupabase('criativos', id, { tag: newTag })
    } catch (err) {
      console.error('Erro ao atualizar tag:', err)
    } finally {
      dirtyRef.current = false
    }
  }

  const handleInlineEditorChange = async (id, newEditor) => {
    dirtyRef.current = true
    setCriativos(prev => prev.map(c => c.id === id ? { ...c, editor: newEditor } : c))
    try {
      await updateInSupabase('criativos', id, { editor: newEditor })
    } catch (err) {
      console.error('Erro ao atualizar editor:', err)
    } finally {
      dirtyRef.current = false
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente remover este criativo?')) {
      dirtyRef.current = true
      setCriativos(prev => prev.filter(c => c.id !== id))
      try {
        await deleteFromSupabase('criativos', id)
      } catch (err) {
        console.error('Erro ao remover criativo:', err)
      } finally {
        dirtyRef.current = false
      }
    }
  }

  const handleClearAll = async () => {
    if (window.confirm('Tem certeza que deseja zerar e apagar todos os criativos da lista?')) {
      dirtyRef.current = true
      setCriativos([])
      try {
        await replaceCollection('criativos', [])
      } catch (err) {
        console.error('Erro ao zerar lista:', err)
      } finally {
        dirtyRef.current = false
      }
    }
  }

  const handleOpenAddModal = () => {
    setEditingItem(null)
    setDraftId(`criativo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
    setFormData({
      status: 'Fila',
      editor: '',
      gravacao: '',
      tag: '',
      nomeArquivo: '',
      linkPastaBase: '',
      arquivoFinalizado: '',
    })
    setAddModalOpen(true)
  }

  const handleOpenEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      status: item.status || 'Fila',
      editor: item.editor || '',
      gravacao: item.gravacao || '',
      tag: item.tag || '',
      nomeArquivo: item.nomeArquivo || '',
      linkPastaBase: item.linkPastaBase || '',
      arquivoFinalizado: item.arquivoFinalizado || '',
    })
    setAddModalOpen(true)
  }

  const handleSaveForm = async (e) => {
    e.preventDefault()
    if (!formData.nomeArquivo.trim()) return

    dirtyRef.current = true
    setAddModalOpen(false)

    try {
      if (editingItem) {
        setCriativos(prev => prev.map(c => c.id === editingItem.id ? { ...c, ...formData } : c))
        await updateInSupabase('criativos', editingItem.id, formData)
      } else {
        const newItem = {
          id: draftId || `criativo-${Date.now()}`,
          ...formData,
          createdAt: new Date().toISOString(),
        }
        setCriativos(prev => [newItem, ...prev])
        await addToSupabase('criativos', newItem)
      }
    } catch (err) {
      console.error('Erro ao salvar formulário:', err)
    } finally {
      dirtyRef.current = false
    }
  }

  const handleCopyLink = (url, idKey) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedId(idKey)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-ink font-bold">Gestão de Criativos</h1>
          <p className="text-sm text-mute mt-1">
            Organize, filtre e acompanhe o status de edição e finalização dos criativos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isVisualizador && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
              <Eye size={14} /> Modo Leitura (Visualizador)
            </div>
          )}

          {canEdit && criativos.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearAll}
              icon={<Trash2 size={16} />}
              className="text-red-500 hover:text-red-600 border-red-500/20 hover:bg-red-500/10"
            >
              Zerar Lista
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportToCSV(criativos, 'criativos-content-hub')}
            icon={<Download size={16} />}
          >
            Exportar CSV
          </Button>

          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                icon={<FileSpreadsheet size={16} />}
              >
                Importar Sheets
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddModal}
                icon={<Plus size={16} />}
              >
                Novo Criativo
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="premium-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Total de Criativos</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 text-ink">
              <FileVideo size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{totalCount}</span>
            <span className="text-xs text-mute">cadastrados</span>
          </div>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Finalizados</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/10 text-emerald-deep dark:text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-deep dark:text-emerald-400">{finalizadosCount}</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">({percentFinalizado}%)</span>
          </div>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Em Fila</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{filaCount}</span>
            <span className="text-xs text-mute">aguardando edição</span>
          </div>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Editores Ativos</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{availableEditors.length}</span>
            <span className="text-xs text-mute">responsáveis ({availableEditors.join(', ')})</span>
          </div>
        </div>

      </div>

      {/* Control Bar (Search & Filters) */}
      <div className="premium-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome, gravação ou editor..."
            className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-4 py-2 text-xs text-ink placeholder:text-faint focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald transition-all"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-mute hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink font-medium focus:border-emerald focus:outline-none"
            >
              <option value="Todos">Todos Status ({totalCount})</option>
              <option value="Fila">Fila ({filaCount})</option>
              <option value="Em Edição">Em Edição ({emEdicaoCount})</option>
              <option value="Finalizado">Finalizado ({finalizadosCount})</option>
            </select>
          </div>

          {/* Editor Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-mute hidden sm:inline">Editor:</span>
            <select
              value={editorFilter}
              onChange={(e) => setEditorFilter(e.target.value)}
              className="rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink font-medium focus:border-emerald focus:outline-none"
            >
              <option value="Todos">Todos Editores</option>
              <option value="Sem Editor">Sem Editor</option>
              {availableEditors.map(ed => (
                <option key={ed} value={ed}>{ed}</option>
              ))}
            </select>
          </div>

          {/* Gravação Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-mute hidden sm:inline">Gravação:</span>
            <select
              value={gravacaoFilter}
              onChange={(e) => setGravacaoFilter(e.target.value)}
              className="rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink font-medium focus:border-emerald focus:outline-none max-w-[160px] truncate"
            >
              <option value="Todos">Todas Gravações</option>
              {availableGravacoes.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Table Container */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            
            {/* Table Header */}
            <thead className="bg-elevated/70 border-b border-hairline text-faint font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5 min-w-[120px]">Status</th>
                <th className="px-4 py-3.5 min-w-[120px]">Editor</th>
                <th className="px-4 py-3.5 min-w-[140px]">Gravação</th>
                <th className="px-4 py-3.5 min-w-[80px]">Tag</th>
                <th className="px-4 py-3.5 min-w-[280px]">Nome do Arquivo</th>
                <th className="px-4 py-3.5 text-right min-w-[80px]">Ações</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-hairline text-ink">
              {filteredCriativos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-mute">
                    Nenhum criativo encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredCriativos.map(item => (
                  <tr key={item.id} className="table-row-hover">
                    
                    {/* Status Dropdown Inline */}
                    <td className="px-4 py-3">
                      <select
                        value={item.status || 'Fila'}
                        disabled={!canEdit}
                        onChange={(e) => handleInlineStatusChange(item.id, e.target.value)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
                          item.status === 'Finalizado'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : item.status === 'Em Edição'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-surface text-mute border-hairline'
                        } ${!canEdit ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        <option value="Fila">Fila</option>
                        <option value="Em Edição">Em Edição</option>
                        <option value="Finalizado">Finalizado</option>
                      </select>
                    </td>

                    {/* Editor Dropdown Inline */}
                    <td className="px-4 py-3">
                      <select
                        value={item.editor || ''}
                        disabled={!canEdit}
                        onChange={(e) => handleInlineEditorChange(item.id, e.target.value)}
                        className={`rounded-lg border border-hairline bg-surface px-2 py-1 text-xs text-mute focus:text-ink focus:border-emerald ${!canEdit ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        <option value="">— Sem Editor —</option>
                        <option value="Ruan">Ruan</option>
                        <option value="Rafael">Rafael</option>
                        {availableEditors.filter(e => e !== 'Ruan' && e !== 'Rafael').map(ed => (
                          <option key={ed} value={ed}>{ed}</option>
                        ))}
                      </select>
                    </td>

                    {/* Gravação */}
                    <td className="px-4 py-3 font-mono text-[11px] text-mute whitespace-nowrap">
                      {item.gravacao || '—'}
                    </td>

                    {/* Tag Dropdown Inline */}
                    <td className="px-4 py-3">
                      <select
                        value={item.tag || ''}
                        disabled={!canEdit}
                        onChange={(e) => handleInlineTagChange(item.id, e.target.value)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
                          item.tag
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-surface text-mute border-hairline'
                        } ${!canEdit ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        <option value="">— Sem tag —</option>
                        <option value="Máquina">Máquina</option>
                        <option value="Perpétuo">Perpétuo</option>
                      </select>
                    </td>

                    {/* Nome Arquivo */}
                    <td className="px-4 py-3 font-medium text-ink">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="text-left hover:text-emerald hover:underline underline-offset-2 transition-colors"
                        title="Abrir criativo (editar e anexar arquivos)"
                      >
                        {item.nomeArquivo}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-mute hover:bg-ink/5 hover:text-ink rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-mute hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-faint text-[10px] italic">Somente leitura</span>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-4 py-3 bg-elevated/40 border-t border-hairline flex items-center justify-between text-xs text-mute">
          <span>Exibindo {filteredCriativos.length} de {totalCount} criativos</span>
          <span className="text-faint font-mono text-[11px]">Content Hub · Criativos</span>
        </div>
      </div>

      {/* Modal Import Sheet */}
      <ImportCriativosSheetModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />

      {/* Modal Add / Edit Single Criativo */}
      {addModalOpen && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-content relative w-full max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <h2 className="text-base font-bold text-ink">
                {editingItem ? 'Editar Criativo' : 'Novo Criativo'}
              </h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1.5 text-mute hover:bg-ink/5 hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 pt-4 text-xs">
              
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Nome do Arquivo / Título *</label>
                <input
                  type="text"
                  required
                  value={formData.nomeArquivo}
                  onChange={(e) => setFormData({ ...formData, nomeArquivo: e.target.value })}
                  placeholder="Ex: Há quanto tempo você não tira férias"
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                  >
                    <option value="Fila">Fila</option>
                    <option value="Em Edição">Em Edição</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Editor Responsável</label>
                  <input
                    type="text"
                    value={formData.editor}
                    onChange={(e) => setFormData({ ...formData, editor: e.target.value })}
                    placeholder="Ex: Ruan, Rafael..."
                    className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Gravação / Aula</label>
                  <input
                    type="text"
                    value={formData.gravacao}
                    onChange={(e) => setFormData({ ...formData, gravacao: e.target.value })}
                    placeholder="Ex: Gravação 10/07, CPL 07/26..."
                    className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Tag / Distintivo</label>
                  <select
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                  >
                    <option value="">— Sem tag —</option>
                    <option value="Máquina">Máquina</option>
                    <option value="Perpétuo">Perpétuo</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-hairline">
                <AttachmentsPanel itemType="criativos" itemId={editingItem?.id || draftId} />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
                <Button variant="secondary" size="sm" type="button" onClick={() => setAddModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  {editingItem ? 'Salvar Alterações' : 'Criar Criativo'}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
