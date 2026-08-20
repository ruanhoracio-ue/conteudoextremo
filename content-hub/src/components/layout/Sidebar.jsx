import { cn } from '../../lib/cn'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Logo } from '../ui/Logo'
import { useAuth } from '../../store/AuthContext'
import {
  LayoutGrid, Calendar, Video, Film, MessageSquareQuote,
  BarChart3, ChevronRight, Settings, TrendingUp, Bot, PenBox, Pickaxe, FileVideo,
  ShieldCheck, LogOut, Eye
} from 'lucide-react'

export function Sidebar({ activePage, onNavigate, collapsed, onToggleCollapse }) {
  const { user, isAdmin, logout } = useAuth()

  const navSections = [
    {
      title: 'Visão Geral',
      icon: BarChart3,
      items: [
        { key: 'dashboard', label: 'Dashboard Geral', icon: BarChart3 },
      ],
    },
    {
      title: 'Produção',
      icon: PenBox,
      items: [
        { key: 'criativos', label: 'Criativos de Tráfego', icon: FileVideo },
        { key: 'producao', label: 'Claude AI', icon: Bot },
        { key: 'mineracao', label: 'Mineração', icon: Pickaxe },
      ],
    },
    {
      title: 'Organização',
      icon: LayoutGrid,
      items: [
        { key: 'videos-longos', label: 'Vídeos Longos', icon: Video },
        { key: 'videos-curtos', label: 'Vídeos Curtos (Reels)', icon: Film },
        { key: 'cortes', label: 'Carrossel / Cortes', icon: LayoutGrid },
        { key: 'frases', label: 'Frases', icon: MessageSquareQuote },
      ],
    },
    {
      title: 'Planejamento',
      icon: Calendar,
      items: [
        { key: 'calendario', label: 'Calendário', icon: Calendar },
      ],
    },
    {
      title: 'Analytics',
      icon: TrendingUp,
      items: [
        { key: 'analytics', label: 'Analytics', icon: TrendingUp },
      ],
    },
    {
      title: 'Sistema',
      icon: Settings,
      items: [
        ...(isAdmin ? [{ key: 'usuarios', label: 'Usuários & Permissões', icon: ShieldCheck }] : []),
        { key: 'settings', label: 'Configurações', icon: Settings },
      ],
    },
  ]

  const roleLabel = {
    admin: 'Administrador',
    editor: 'Editor',
    visualizador: 'Visualizador',
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen border-r border-hairline bg-surface transition-all duration-300 z-30 shrink-0 select-none',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-hairline">
        {!collapsed && (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <Logo className="h-5 w-auto" />
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-mute hover:bg-ink/5 hover:text-ink transition-colors mx-auto"
          title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', !collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-6">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold text-faint uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200',
                    isActive
                      ? 'bg-emerald/10 text-emerald-deep dark:text-emerald-400 font-bold border border-emerald/20 shadow-xs'
                      : 'text-mute hover:bg-ink/5 hover:text-ink',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-emerald' : 'text-mute')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer Profile & Theme Toggle */}
      <div className="p-3 border-t border-hairline space-y-2">
        <div className={cn('flex items-center justify-between', collapsed && 'flex-col gap-2')}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald/10 text-emerald font-bold text-xs shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-ink truncate">{user?.name || 'Usuário'}</p>
                <p className="text-[10px] text-mute truncate capitalize">
                  {roleLabel[user?.role] || 'Editor'}
                </p>
              </div>
            </div>
          )}
          <ThemeToggle />
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-mute hover:text-danger hover:bg-danger/5 border border-hairline transition-colors"
          title="Sair"
        >
          <LogOut size={14} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
