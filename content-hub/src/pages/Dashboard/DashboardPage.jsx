import { useMemo, useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { useSpotlight } from '../../lib/useSpotlight'
import { loadCollection } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import {
  Video, Film, LayoutGrid, Sparkles, MessageSquareQuote, Calendar,
  Clock, CheckCircle2, AlertCircle, ArrowRight, ExternalLink,
  Users, Layers, FileVideo, Filter, Search, ChevronRight, Folder, Eye, Check
} from 'lucide-react'

export function DashboardPage({ onNavigate }) {
  // Load Criativos from Supabase (single source of truth)
  const [criativos, setCriativos] = useState([])

  useEffect(() => {
    let mounted = true
    async function loadCriativos() {
      const items = await loadCollection('criativos')
      if (mounted) setCriativos(items || [])
    }
    loadCriativos()
    const interval = setInterval(loadCriativos, 5000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  const state = useStore()

  // Filters state
  const [statusFilterTab, setStatusFilterTab] = useState('a-fazer') // 'a-fazer' | 'aprovados' | 'publicados' | 'todos'
  const [activeSectorTab, setActiveSectorTab] = useState('todos') // 'todos' | 'criativos' | 'longos' | 'curtos' | 'cortes'
  const [editorFilter, setEditorFilter] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Spotlight hooks for KPI cards
  const kpiSpotlight1 = useSpotlight()
  const kpiSpotlight2 = useSpotlight()
  const kpiSpotlight3 = useSpotlight()
  const kpiSpotlight4 = useSpotlight()

  // Calculate stats & item list across ALL sectors with accurate statuses
  const dashboardData = useMemo(() => {
    const vl = state?.videosLongos || []
    const vc = state?.videosCurtos || []
    const co = state?.cortes || []
    const fr = state?.frases || []
    const cal = state?.calendario || []

    // Map 1: Criativos de Tráfego
    const criativosMapped = criativos.map(c => {
      const isApproved = c.status === 'Aprovado'
      const isFinished = c.status === 'Finalizado'
      const isPending = !isApproved && !isFinished

      return {
        id: `cria-${c.id}`,
        sector: 'Criativos de Tráfego',
        sectorKey: 'criativos',
        icon: Sparkles,
        title: c.nomeArquivo,
        status: c.status || 'Fila',
        isApproved,
        isFinished,
        isPending,
        editor: c.editor || '—',
        gravacao: c.gravacao || 'Tráfego',
        tag: c.tag,
        linkDrive: c.linkPastaBase || '',
        origemTab: 'criativos',
      }
    })

    // Map 2: Vídeos Longos (YouTube)
    const vlMapped = vl.map(i => {
      const isFinished = !!i.publicado
      const isApproved = !isFinished && !!i.aprovado
      const isPending = !isFinished && !isApproved

      const status = isFinished
        ? 'Publicado'
        : isApproved
        ? 'Aprovado'
        : i.editado
        ? 'Editado (Em Análise)'
        : i.gravado
        ? 'Gravado (Em Edição)'
        : 'A Gravar'

      return {
        id: `vl-${i.id}`,
        sector: 'Vídeos Longos',
        sectorKey: 'longos',
        icon: Video,
        title: i.tema || i.titulo || 'Vídeo Longo sem título',
        status,
        isApproved,
        isFinished,
        isPending,
        editor: i.editor || i.ondeQuem || '—',
        gravacao: i.ondeQuem || 'YouTube',
        linkDrive: i.linkPasta || i.linkFinalizado || '',
        origemTab: 'videos-longos',
      }
    })

    // Map 3: Vídeos Curtos (Reels / TikTok / Shorts)
    const vcMapped = vc.map(i => {
      const isFinished = !!i.publicado
      const isApproved = !isFinished && !!i.aprovado
      const isPending = !isFinished && !isApproved

      const status = isFinished
        ? 'Publicado'
        : isApproved
        ? 'Aprovado'
        : i.editado
        ? 'Editado'
        : 'Em Edição'

      return {
        id: `vc-${i.id}`,
        sector: 'Vídeos Curtos',
        sectorKey: 'curtos',
        icon: Film,
        title: i.titulo || 'Vídeo Curto sem título',
        status,
        isApproved,
        isFinished,
        isPending,
        editor: i.editor || '—',
        gravacao: i.plataforma || 'Reels / Shorts',
        linkDrive: i.linkFinalizado || '',
        origemTab: 'videos-curtos',
      }
    })

    // Map 4: Carrossel
    const coMapped = co.map(i => {
      const isFinished = !!i.publicado
      const isApproved = !isFinished && !!i.aprovado
      const isPending = !isFinished && !isApproved

      const status = isFinished
        ? 'Publicado'
        : isApproved
        ? 'Aprovado'
        : i.editado
        ? 'Editado'
        : 'Fila'

      return {
        id: `co-${i.id}`,
        sector: 'Carrossel',
        sectorKey: 'cortes',
        icon: LayoutGrid,
        title: i.titulo || 'Carrossel sem título',
        status,
        isApproved,
        isFinished,
        isPending,
        editor: i.editor || '—',
        gravacao: 'Instagram',
        linkDrive: i.linkFinalizado || '',
        origemTab: 'cortes',
      }
    })

    // Combined List
    const allItemsList = [
      ...criativosMapped,
      ...vlMapped,
      ...vcMapped,
      ...coMapped,
    ]

    // Summary Statistics
    const totalCount = allItemsList.length
    const pendingItems = allItemsList.filter(i => i.isPending)
    const approvedItems = allItemsList.filter(i => i.isApproved)
    const finishedItems = allItemsList.filter(i => i.isFinished)

    const pendingCount = pendingItems.length
    const approvedCount = approvedItems.length
    const finishedCount = finishedItems.length

    // Criativos específicos
    const criativosPending = criativosMapped.filter(i => i.isPending).length
    const criativosApproved = criativosMapped.filter(i => i.isApproved).length

    // Longos específicos
    const vlPending = vlMapped.filter(i => i.isPending).length
    const vlApproved = vlMapped.filter(i => i.isApproved).length

    // Completion percentage
    const completionRate = totalCount > 0 ? Math.round(((approvedCount + finishedCount) / totalCount) * 100) : 0

    // Editors workload
    const editorsWorkload = {}
    pendingItems.forEach(item => {
      const ed = item.editor && item.editor !== '—' ? item.editor : 'Sem Editor'
      if (!editorsWorkload[ed]) editorsWorkload[ed] = 0
      editorsWorkload[ed]++
    })

    // Calendar upcoming items
    const todayStr = new Date().toISOString().split('T')[0]
    const upcomingCalendar = cal
      .filter(i => i.agenda >= todayStr && i.status !== 'Publicado')
      .slice(0, 4)

    return {
      allItemsList,
      pendingItems,
      approvedItems,
      finishedItems,
      totalCount,
      pendingCount,
      approvedCount,
      finishedCount,
      criativosPending,
      criativosApproved,
      vlPending,
      vlApproved,
      completionRate,
      editorsWorkload: Object.entries(editorsWorkload).map(([name, count]) => ({ name, count })),
      upcomingCalendar,
    }
  }, [criativos, state])

  // Filtered List based on status tab, sector tab, editor, and search term
  const filteredList = useMemo(() => {
    return dashboardData.allItemsList.filter(item => {
      // Status Filter Tab
      if (statusFilterTab === 'a-fazer' && !item.isPending) return false
      if (statusFilterTab === 'aprovados' && !item.isApproved) return false
      if (statusFilterTab === 'publicados' && !item.isFinished) return false

      // Sector Tab
      if (activeSectorTab !== 'todos' && item.sectorKey !== activeSectorTab) return false

      // Editor Filter
      if (editorFilter !== 'Todos') {
        if (editorFilter === 'Sem Editor' && item.editor !== '—' && item.editor) return false
        if (editorFilter !== 'Sem Editor' && item.editor !== editorFilter) return false
      }

      // Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(term)
        const matchGravacao = item.gravacao.toLowerCase().includes(term)
        const matchEditor = item.editor.toLowerCase().includes(term)
        if (!matchTitle && !matchGravacao && !matchEditor) return false
      }

      return true
    })
  }, [dashboardData.allItemsList, statusFilterTab, activeSectorTab, editorFilter, searchTerm])

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-ink font-bold">Dashboard Geral</h1>
          <p className="text-sm text-mute mt-1">
            Visão consolidada do fluxo de produção, aprovações e vídeos a fazer
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate && onNavigate('criativos')}
            icon={<Sparkles size={16} />}
          >
            Criativos de Tráfego
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate && onNavigate('criativos')}
            icon={<ArrowRight size={16} />}
          >
            Importar Sheets
          </Button>
        </div>
      </div>

      {/* Top Global KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Conteúdos a Fazer (Pendente) */}
        <div
          className={`premium-card p-5 cursor-pointer transition-all ${statusFilterTab === 'a-fazer' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setStatusFilterTab('a-fazer')}
          {...kpiSpotlight1}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Conteúdos a Fazer</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">{dashboardData.pendingCount}</span>
            <span className="text-xs font-semibold text-amber-500">na fila de edição</span>
          </div>
        </div>

        {/* KPI 2: Aprovados */}
        <div
          className={`premium-card p-5 cursor-pointer transition-all ${statusFilterTab === 'aprovados' ? 'ring-2 ring-emerald-500/50' : ''}`}
          onClick={() => setStatusFilterTab('aprovados')}
          {...kpiSpotlight2}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Aprovados (Prontos)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/10 text-emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-deep dark:text-emerald-400">{dashboardData.approvedCount}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">prontos p/ publicar</span>
          </div>
        </div>

        {/* KPI 3: Publicados / Finalizados */}
        <div
          className={`premium-card p-5 cursor-pointer transition-all ${statusFilterTab === 'publicados' ? 'ring-2 ring-blue-500/50' : ''}`}
          onClick={() => setStatusFilterTab('publicados')}
          {...kpiSpotlight3}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Publicados / Finalizados</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Video size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dashboardData.finishedCount}</span>
            <span className="text-xs text-mute">em circulação</span>
          </div>
        </div>

        {/* KPI 4: Conclusão Geral */}
        <div
          className={`premium-card p-5 cursor-pointer transition-all ${statusFilterTab === 'todos' ? 'ring-2 ring-emerald-500/50' : ''}`}
          onClick={() => setStatusFilterTab('todos')}
          {...kpiSpotlight4}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-faint uppercase tracking-wider">Taxa de Conclusão</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/10 text-emerald">
              <Check size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-deep dark:text-emerald-400">{dashboardData.completionRate}%</span>
            <span className="text-xs text-mute">acervo aprovado</span>
          </div>
        </div>

      </div>

      {/* Main Section: Content List */}
      <div className="space-y-4">
        
        {/* Status Filter Tabs (Top Row) */}
        <div className="flex items-center gap-2 border-b border-hairline pb-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setStatusFilterTab('a-fazer')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
              statusFilterTab === 'a-fazer'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs'
                : 'bg-surface text-mute border-hairline hover:text-ink'
            }`}
          >
            <Clock size={14} /> ⏳ A Fazer ({dashboardData.pendingCount})
          </button>
          <button
            onClick={() => setStatusFilterTab('aprovados')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
              statusFilterTab === 'aprovados'
                ? 'bg-emerald/10 text-emerald-deep dark:text-emerald-400 border-emerald/30 shadow-xs'
                : 'bg-surface text-mute border-hairline hover:text-ink'
            }`}
          >
            <CheckCircle2 size={14} /> ✅ Aprovados ({dashboardData.approvedCount})
          </button>
          <button
            onClick={() => setStatusFilterTab('publicados')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
              statusFilterTab === 'publicados'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-xs'
                : 'bg-surface text-mute border-hairline hover:text-ink'
            }`}
          >
            <Video size={14} /> 🌐 Publicados ({dashboardData.finishedCount})
          </button>
          <button
            onClick={() => setStatusFilterTab('todos')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
              statusFilterTab === 'todos'
                ? 'bg-surface text-ink border-hairline-strong shadow-xs'
                : 'bg-surface text-mute border-hairline hover:text-ink'
            }`}
          >
            <Layers size={14} /> Todos os Conteúdos ({dashboardData.totalCount})
          </button>
        </div>

        {/* Controls Bar & Sector Tabs */}
        <div className="premium-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Sector Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-elevated/60 p-1 rounded-xl border border-hairline">
            <button
              onClick={() => setActiveSectorTab('todos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSectorTab === 'todos' ? 'bg-surface text-ink shadow-xs' : 'text-mute hover:text-ink'
              }`}
            >
              Todos os Setores
            </button>
            <button
              onClick={() => setActiveSectorTab('criativos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSectorTab === 'criativos' ? 'bg-surface text-emerald-deep dark:text-emerald-400 shadow-xs' : 'text-mute hover:text-ink'
              }`}
            >
              Criativos
            </button>
            <button
              onClick={() => setActiveSectorTab('longos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSectorTab === 'longos' ? 'bg-surface text-blue-500 shadow-xs' : 'text-mute hover:text-ink'
              }`}
            >
              Vídeos Longos
            </button>
            <button
              onClick={() => setActiveSectorTab('curtos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSectorTab === 'curtos' ? 'bg-surface text-purple-500 shadow-xs' : 'text-mute hover:text-ink'
              }`}
            >
              Reels / Curtos
            </button>
            <button
              onClick={() => setActiveSectorTab('cortes')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeSectorTab === 'cortes' ? 'bg-surface text-amber-500 shadow-xs' : 'text-mute hover:text-ink'
              }`}
            >
              Carrossel
            </button>
          </div>

          {/* Search & Editor Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar conteúdo..."
                className="w-full rounded-xl border border-hairline bg-surface pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-faint focus:border-emerald focus:outline-none"
              />
            </div>

            <select
              value={editorFilter}
              onChange={(e) => setEditorFilter(e.target.value)}
              className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs text-ink font-medium focus:border-emerald focus:outline-none"
            >
              <option value="Todos">Todos Editores</option>
              <option value="Sem Editor">Sem Editor</option>
              {dashboardData.editorsWorkload.map(ed => (
                <option key={ed.name} value={ed.name}>{ed.name} ({ed.count})</option>
              ))}
            </select>
          </div>

        </div>

        {/* Content Table */}
        <div className="premium-card overflow-hidden">
          <div className="p-4 border-b border-hairline flex items-center justify-between">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-emerald" /> Listagem de Conteúdos ({filteredList.length})
            </h2>
            <span className="text-[11px] text-mute">
              Exibindo: <strong className="text-ink font-semibold capitalize">{statusFilterTab.replace('-', ' ')}</strong>
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-hairline text-faint font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 min-w-[140px]">Setor</th>
                  <th className="px-4 py-3 min-w-[280px]">Título / Nome do Conteúdo</th>
                  <th className="px-4 py-3 min-w-[130px]">Status Real</th>
                  <th className="px-4 py-3 min-w-[120px]">Editor</th>
                  <th className="px-4 py-3 min-w-[130px]">Gravação / Origem</th>
                  <th className="px-4 py-3 text-right min-w-[120px]">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-mute">
                      <CheckCircle2 size={24} className="mx-auto text-emerald mb-2" />
                      Nenhum conteúdo encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredList.map(item => {
                    const IconComponent = item.icon
                    const isApproved = item.status === 'Aprovado'
                    const isFinished = item.status === 'Publicado' || item.status === 'Finalizado'

                    return (
                      <tr key={item.id} className="table-row-hover">
                        
                        {/* Sector Badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface border border-hairline text-ink">
                            <IconComponent size={13} className="text-emerald shrink-0" />
                            {item.sector}
                          </span>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3 font-medium text-ink">
                          {item.title}
                          {item.tag && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              {item.tag}
                            </span>
                          )}
                        </td>

                        {/* Status Real Badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isApproved
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : isFinished
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : item.status.includes('Edição')
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          }`}>
                            {isApproved && <CheckCircle2 size={12} />}
                            {isFinished && <Check size={12} />}
                            {item.status}
                          </span>
                        </td>

                        {/* Editor */}
                        <td className="px-4 py-3 font-semibold text-mute whitespace-nowrap">
                          {item.editor}
                        </td>

                        {/* Gravação / Origem */}
                        <td className="px-4 py-3 font-mono text-[11px] text-mute whitespace-nowrap">
                          {item.gravacao}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {item.linkDrive ? (
                              <a
                                href={item.linkDrive}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-[11px] font-medium transition-colors"
                              >
                                <Folder size={12} /> Drive <ExternalLink size={10} />
                              </a>
                            ) : null}
                            <button
                              onClick={() => onNavigate && onNavigate(item.origemTab)}
                              className="p-1.5 text-mute hover:bg-ink/5 hover:text-ink rounded-lg transition-colors"
                              title="Abrir no Setor"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Bottom Grid: Editors Workload & Upcoming Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Editors Workload Card */}
        <div className="premium-card p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Users size={16} className="text-emerald" /> Carga de Trabalho por Editor (Conteúdos a Fazer)
            </h3>
            <span className="text-[11px] text-mute">{dashboardData.editorsWorkload.length} responsáveis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {dashboardData.editorsWorkload.map(ed => (
              <div key={ed.name} className="p-3 rounded-xl bg-elevated/50 border border-hairline flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-ink">{ed.name}</p>
                  <p className="text-[11px] text-mute mt-0.5">conteúdos a fazer</p>
                </div>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                  {ed.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Calendar Card */}
        <div className="premium-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Calendar size={16} className="text-emerald" /> Próximos Lançamentos
            </h3>
            <button
              onClick={() => onNavigate && onNavigate('calendario')}
              className="text-xs text-emerald font-semibold hover:underline"
            >
              Ver tudo
            </button>
          </div>

          <div className="space-y-2.5">
            {dashboardData.upcomingCalendar.length === 0 ? (
              <p className="text-xs text-mute text-center py-4">Nenhum lançamento agendado para os próximos dias.</p>
            ) : (
              dashboardData.upcomingCalendar.map(calItem => (
                <div key={calItem.id} className="p-2.5 rounded-xl bg-elevated/40 border border-hairline flex items-center justify-between">
                  <div className="overflow-hidden pr-2">
                    <p className="text-xs font-medium text-ink truncate">{calItem.titulo}</p>
                    <p className="text-[10px] font-mono text-mute">{calItem.agenda}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 shrink-0">
                    {calItem.canal || 'Geral'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
