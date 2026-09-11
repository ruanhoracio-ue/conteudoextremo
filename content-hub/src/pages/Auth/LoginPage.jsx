import { useState } from 'react'
import { Logo } from '../../components/ui/Logo'
import { DotPattern } from '../../components/ui/DotPattern'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../store/AuthContext'
import { Shield, Lock, Mail, User, Clock, AlertCircle, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react'

export function LoginPage() {
  const { login, register, pendingNoticeUser, setPendingNoticeUser } = useAuth()
  
  const [activeTab, setActiveTab] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      if (activeTab === 'login') {
        const res = await login({ email, password })
        if (res.isPending) {
          // Handled by pendingNoticeUser in AuthContext
        }
      } else {
        if (!name.trim()) {
          throw new Error('Por favor, informe seu nome completo.')
        }
        await register({ name, email, password })
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao autenticar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ds-app relative min-h-screen overflow-hidden bg-canvas flex flex-col items-center justify-center p-4 antialiased">
      {/* Fundo de pontos com halo atrás do card */}
      <DotPattern
        width={20}
        height={20}
        cr={1.2}
        fill="fill-ink/15"
        className="[mask-image:radial-gradient(460px_circle_at_center,white,transparent)]"
      />

      {/* Container */}
      <div className="relative z-10 w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <Logo className="h-9 w-auto" />
          </div>
        </div>

        {/* Pending Approval Screen Card */}
        {pendingNoticeUser ? (
          <div className="premium-card p-6 border border-amber-500/30 bg-surface space-y-5 text-center shadow-xl animate-fadeIn">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <Clock size={28} />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-ink">Aguardando Aprovação do Admin</h2>
              <p className="text-xs text-mute leading-relaxed">
                Olá, <strong className="text-ink">{pendingNoticeUser.name}</strong>! Seu cadastro foi realizado com sucesso e enviado para análise do Administrador.
              </p>
            </div>

            <div className="rounded-xl border border-hairline bg-elevated/50 p-3 text-left text-xs space-y-1 font-mono text-mute">
              <div><strong className="text-ink font-sans">E-mail:</strong> {pendingNoticeUser.email}</div>
              <div><strong className="text-ink font-sans">Status:</strong> Pendente de Liberação</div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setPendingNoticeUser(null)
                  setActiveTab('login')
                  setEmail('')
                  setPassword('')
                }}
                className="w-full rounded-xl bg-inverse text-on-inverse px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Voltar para Tela de Login
              </button>
            </div>
          </div>
        ) : (
          /* Main Login / Register Card */
          <div className="premium-card p-6 bg-surface shadow-2xl border border-hairline space-y-6">
            
            {/* Tabs */}
            <div className="flex rounded-xl bg-elevated p-1 border border-hairline">
              <button
                onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'login'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-mute hover:text-ink'
                }`}
              >
                Entrar no Portal
              </button>
              <button
                onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'register'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-mute hover:text-ink'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-3 py-2.5 text-xs text-ink placeholder:text-faint focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Endereço de E-mail *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@conversaoextrema.com"
                    className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-3 py-2.5 text-xs text-ink placeholder:text-faint focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Senha de Acesso *
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-3 py-2.5 text-xs text-ink placeholder:text-faint focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="shiny"
                  size="md"
                  disabled={loading}
                  className="w-full text-xs font-bold"
                  icon={<ArrowRight size={16} />}
                >
                  {loading ? 'Processando...' : activeTab === 'login' ? 'Entrar' : 'Cadastrar Conta'}
                </Button>
              </div>

            </form>

            {/* Information Callout */}
            <div className="pt-3 border-t border-hairline text-[11px] text-mute space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-ink">
                <Shield size={13} className="text-emerald" /> Controle de Acesso Seguro (Better Auth)
              </p>
              <p className="text-faint leading-tight">
                • O primeiro cadastro vira o <strong>Admin</strong> principal.<br />
                • Novos membros passam por aprovação do Admin.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
