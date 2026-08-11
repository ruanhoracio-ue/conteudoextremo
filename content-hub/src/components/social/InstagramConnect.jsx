import { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { toast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { api } from '../../lib/api'
import { Loader2, Settings2 } from 'lucide-react'

export function InstagramConnect() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function fetchUser() {
    setLoading(true)
    const res = await api.instagramUser()
    if (!res.error) setUser(res.data)
    else setUser(null)
    setLoading(false)
  }

  useEffect(() => { fetchUser() }, [])

  async function handleSave() {
    if (!tokenInput || !userIdInput) {
      toast('Preencha o token e o user ID')
      return
    }
    setSaving(true)
    const res = await api.post('/instagram/configure', { accessToken: tokenInput, userId: userIdInput })
    if (res.error) {
      toast(res.error)
    } else {
      toast('Credenciais salvas!')
      setConfigOpen(false)
      setTokenInput('')
      setUserIdInput('')
      fetchUser()
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Instagram</p>
          <p className="text-xs text-mute">
            {loading ? 'Verificando...' : user ? `@${user.username}` : 'Token não configurado'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 size={16} className="animate-spin text-mute" />
        ) : user ? (
          <Badge tone="emerald">Conectado</Badge>
        ) : (
          <Button variant="ghost" size="sm" icon={<Settings2 size={14} />} onClick={() => setConfigOpen(true)}>
            Configurar
          </Button>
        )}
      </div>

      <Modal isOpen={configOpen} onClose={() => setConfigOpen(false)} title="Configurar Instagram" size="md">
        <div className="space-y-4">
          <p className="text-sm text-mute">Cole o token de acesso e o ID do usuário do Instagram.</p>
          <Input
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="INSTAGRAM_ACCESS_TOKEN"
          />
          <Input
            value={userIdInput}
            onChange={e => setUserIdInput(e.target.value)}
            placeholder="INSTAGRAM_USER_ID"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function YoutubeConnect() {
  const [connected] = useState(() => !!localStorage.getItem('yt_connected'))

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">YouTube</p>
          <p className="text-xs text-mute">
            {connected ? 'Conectado' : 'Configure a API Key no servidor'}
          </p>
        </div>
      </div>
      {connected ? (
        <Badge tone="emerald">Conectado</Badge>
      ) : (
        <Badge tone="neutral">API Key</Badge>
      )}
    </div>
  )
}
