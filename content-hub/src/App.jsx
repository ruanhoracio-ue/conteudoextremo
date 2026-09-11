import { useState } from 'react'
import { StoreProvider } from './store/useStore'
import { AuthProvider, useAuth } from './store/AuthContext'
import { LoginPage } from './pages/Auth/LoginPage'
import SplashScreen from './components/SplashScreen'
import { AppShell } from './components/layout/AppShell'
import { VideosLongosTab } from './pages/Organization/VideosLongosTab'
import { VideosCurtosTab } from './pages/Organization/VideosCurtosTab'
import { CortesTab } from './pages/Organization/CortesTab'
import { FrasesTab } from './pages/Organization/FrasesTab'
import { CalendarPage } from './pages/Calendar/CalendarPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { TeamPage } from './pages/Team/TeamPage'
import { ProducaoPage } from './pages/Producao/ProducaoPage'
import { MineracaoPage } from './pages/Mineracao/MineracaoPage'
import { CriativosPage } from './pages/Criativos/CriativosPage'
import { UsersManagementPage } from './pages/Team/UsersManagementPage'
import { CofrePage } from './pages/Cofre/CofrePage'
import { ToastContainer } from './components/ui/Toast'
import { Tabs } from './components/ui/Tabs'
import { ImportSheetModal } from './components/ImportSheetModal'
import { Button } from './components/ui/Button'
import { FileSpreadsheet, Eye } from 'lucide-react'

const orgTabs = [
  { key: 'videos-longos', label: 'Vídeos Longos' },
  { key: 'videos-curtos', label: 'Vídeos Curtos' },
  { key: 'cortes', label: 'Carrossel' },
  { key: 'frases', label: 'Frases' },
]

function OrganizationPage({ activeSubTab, onNavigate }) {
  const [sheetModalOpen, setSheetModalOpen] = useState(false)
  const { canEdit, isVisualizador } = useAuth()

  const pageMap = {
    'videos-longos': <VideosLongosTab onNavigate={onNavigate} />,
    'videos-curtos': <VideosCurtosTab onNavigate={onNavigate} />,
    'cortes': <CortesTab onNavigate={onNavigate} />,
    'frases': <FrasesTab />,
  }
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-lg text-ink">{pageTitles[activeSubTab] || 'Organização'}</h1>
          <p className="text-sm text-mute mt-1">{pageDescriptions[activeSubTab]}</p>
        </div>
        {canEdit ? (
          <Button variant="secondary" size="sm" onClick={() => setSheetModalOpen(true)} icon={<FileSpreadsheet size={16} />}>
            Importar Sheets
          </Button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
            <Eye size={14} /> Modo Leitura (Visualizador)
          </div>
        )}
      </div>
      <div className="mt-4">
        <Tabs tabs={orgTabs} active={activeSubTab} onChange={onNavigate} />
      </div>
      <div className="mt-6">
        {pageMap[activeSubTab] || <VideosLongosTab onNavigate={onNavigate} />}
      </div>
      {canEdit && <ImportSheetModal isOpen={sheetModalOpen} onClose={() => setSheetModalOpen(false)} />}
    </>
  )
}

const pageTitles = {
  'videos-longos': 'Vídeos Longos',
  'videos-curtos': 'Vídeos Curtos',
  'cortes': 'Carrossel',
  'frases': 'Frases',
}

const pageDescriptions = {
  'videos-longos': 'Gerencie seus vídeos longos do YouTube',
  'videos-curtos': 'Acompanhe Reels, TikTok e Shorts',
  'cortes': 'Crie e gerencie carrosséis para o Instagram',
  'frases': 'Métricas de performance das suas frases',
}

function MainAppContent() {
  const { isAuthenticated, isAdmin, canEdit } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')
  const [splashDone, setSplashDone] = useState(false)

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const isOrgPage = orgTabs.some(t => t.key === activePage)

  return (
    <>
      {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
      {splashDone && (
        <>
          <AppShell activePage={activePage} onNavigate={setActivePage}>
            {isOrgPage && <OrganizationPage activeSubTab={activePage} onNavigate={setActivePage} />}
            {activePage === 'criativos' && <CriativosPage />}
            {activePage === 'usuarios' && isAdmin && <UsersManagementPage />}
            {activePage === 'cofre' && canEdit && <CofrePage />}
            {activePage === 'producao' && <ProducaoPage onNavigate={setActivePage} />}
            {activePage === 'mineracao' && <MineracaoPage />}
            {activePage === 'calendario' && <CalendarPage />}
            {activePage === 'dashboard' && <DashboardPage onNavigate={setActivePage} />}
            {activePage === 'analytics' && <AnalyticsPage />}
            {activePage === 'equipe' && <TeamPage />}
            {activePage === 'settings' && <SettingsPage />}
          </AppShell>
          <ToastContainer />
        </>
      )}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <MainAppContent />
      </StoreProvider>
    </AuthProvider>
  )
}
