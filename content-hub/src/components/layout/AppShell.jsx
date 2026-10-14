import { useState } from 'react'
import { Sidebar } from './Sidebar'

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
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="mx-auto max-w-container-wide px-6 py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
