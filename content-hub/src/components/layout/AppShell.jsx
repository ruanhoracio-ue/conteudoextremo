import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { DotPattern } from '../ui/DotPattern'

export function AppShell({ activePage, onNavigate, children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="ds-app flex h-screen overflow-hidden bg-canvas text-body antialiased">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      {/* O padrão de pontos fica fixo sob a área de conteúdo; quem rola é o
          filho por cima dele — se estivesse dentro do elemento que rola, ele
          acompanharia o conteúdo e sumiria depois da primeira tela. */}
      <main className="relative flex-1 overflow-hidden">
        <DotPattern
          width={20}
          height={20}
          cr={1.2}
          fill="fill-ink/[0.08]"
          className="[mask-image:linear-gradient(to_bottom,white_0%,white_40%,transparent_100%)]"
        />
        <div className="relative z-10 h-full overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-container-wide px-6 py-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
