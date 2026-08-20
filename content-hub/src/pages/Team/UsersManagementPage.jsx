import { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import { Users, Shield, UserPlus, CheckCircle2, XCircle, Clock, Trash2, ShieldCheck, Eye, Edit3, Lock, Check, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'

export function UsersManagementPage() {
  const {
    user: currentUser,
    allUsers,
    approveUser,
    rejectUser,
    changeRole,
    changeName,
    createUserByAdmin,
    deleteUser,
  } = useAuth()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'editor',
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingName, setEditingName] = useState('')

  const startEditName = (u) => {
    setEditingUserId(u.id)
    setEditingName(u.name || '')
  }

  const cancelEditName = () => {
    setEditingUserId(null)
    setEditingName('')
  }

  const saveEditName = async (userId) => {
    if (!editingName.trim()) return
    try {
      await changeName(userId, editingName)
      cancelEditName()
    } catch (err) {
      window.alert(err.message || 'Erro ao alterar o nome de usuário.')
    }
  }

  const pendingUsers = allUsers.filter(u => u.status === 'pending')
  const activeUsers = allUsers.filter(u => u.status !== 'pending')

  const handleCreateUser = (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      createUserByAdmin(formData)
      setFormData({ name: '', email: '', password: '', role: 'editor' })
      setCreateModalOpen(false)
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao criar usuário.')
    }
  }

  const roleBadges = {
    admin: { label: 'Admin', icon: ShieldCheck, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    editor: { label: 'Editor', icon: Edit3, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    visualizador: { label: 'Visualizador', icon: Eye, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-ink font-bold flex items-center gap-2">
            <Shield className="text-emerald" size={24} /> Gerenciamento de Usuários & Permissões
          </h1>
          <p className="text-sm text-mute mt-1">
            Controle quem pode acessar, editar ou administrar o portal Content Hub (Better Auth RBAC)
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          icon={<UserPlus size={16} />}
        >
          Criar Novo Usuário
        </Button>
      </div>

      {/* Role Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="premium-card p-4 space-y-1.5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 font-bold text-xs text-ink">
            <ShieldCheck size={16} className="text-emerald" /> Administrador (Admin)
          </div>
          <p className="text-xs text-mute">
            Acesso total. Cria e edita conteúdos, gerencia usuários, aprova solicitações e altera cargos.
          </p>
        </div>

        <div className="premium-card p-4 space-y-1.5 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 font-bold text-xs text-ink">
            <Edit3 size={16} className="text-blue-500" /> Editor
          </div>
          <p className="text-xs text-mute">
            Cria e edita conteúdos e criativos no portal. Não possui acesso à gestão de usuários.
          </p>
        </div>

        <div className="premium-card p-4 space-y-1.5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 font-bold text-xs text-ink">
            <Eye size={16} className="text-amber-500" /> Visualizador
          </div>
          <p className="text-xs text-mute">
            Modo Leitura. Apenas visualiza dashboards e tabelas; botões de edição ficam desabilitados.
          </p>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingUsers.length > 0 && (
        <div className="premium-card p-5 border border-amber-500/30 bg-amber-500/5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold text-ink">
              Solicitações Pendentes de Aprovação ({pendingUsers.length})
            </h2>
          </div>

          <div className="divide-y divide-hairline">
            {pendingUsers.map(pUser => (
              <div key={pUser.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink">{pUser.name}</p>
                  <p className="text-xs font-mono text-mute">{pUser.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveUser(pUser.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-semibold text-xs hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    <CheckCircle2 size={14} /> Aprovar Acesso
                  </button>
                  <button
                    onClick={() => rejectUser(pUser.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-semibold text-xs transition-colors"
                  >
                    <XCircle size={14} /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="premium-card overflow-hidden">
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
            Usuários Cadastrados ({activeUsers.length})
          </h2>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-elevated/70 border-b border-hairline text-faint font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Usuário</th>
                <th className="px-4 py-3.5">E-mail</th>
                <th className="px-4 py-3.5">Cargo / Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink">
              {activeUsers.map(u => {
                const BadgeConfig = roleBadges[u.role] || roleBadges.visualizador
                const IconComp = BadgeConfig.icon
                const isSelf = u.id === currentUser?.id

                return (
                  <tr key={u.id} className="table-row-hover">
                    
                    <td className="px-4 py-3 font-semibold text-ink">
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditName(u.id)
                              if (e.key === 'Escape') cancelEditName()
                            }}
                            className="w-44 rounded-lg border border-hairline bg-surface px-2.5 py-1 text-sm font-normal text-ink focus:border-emerald focus:outline-none"
                            placeholder="Nome de usuário"
                          />
                          <button
                            onClick={() => saveEditName(u.id)}
                            disabled={!editingName.trim()}
                            className="p-1.5 rounded-lg text-emerald transition-colors hover:bg-emerald/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Salvar nome"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={cancelEditName}
                            className="p-1.5 rounded-lg text-mute transition-colors hover:bg-red-500/10 hover:text-red-500"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald/10 text-emerald font-bold text-xs">
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          {u.name} {isSelf && <span className="text-[10px] text-faint font-normal">(Você)</span>}
                          <button
                            onClick={() => startEditName(u)}
                            className="p-1 rounded-lg text-faint transition-colors hover:bg-emerald/10 hover:text-emerald"
                            title="Alterar nome de usuário"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-mute">
                      {u.email}
                    </td>

                    {/* Role Change Dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={u.role || 'visualizador'}
                        disabled={isSelf}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border cursor-pointer ${BadgeConfig.color}`}
                      >
                        <option value="admin">Admin (Cria, Edita & Gerencia)</option>
                        <option value="editor">Editor (Edita Conteúdos)</option>
                        <option value="visualizador">Visualizador (Leitura)</option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        {u.status === 'approved' ? 'Aprovado' : 'Recusado'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja remover o usuário ${u.name}?`)) {
                              deleteUser(u.id)
                            }
                          }}
                          className="p-1.5 text-mute hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                          title="Excluir Usuário"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Admin Create User */}
      {createModalOpen && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-content relative w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <UserPlus size={18} className="text-emerald" /> Criar Usuário Pré-Aprovado
              </h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-mute hover:text-ink"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-500">{errorMsg}</p>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do usuário"
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@conversaoextrema.com"
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Senha Provisória *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Cargo / Permissões *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
                >
                  <option value="admin">Admin (Cria, edita e gerencia usuários)</option>
                  <option value="editor">Editor (Cria e edita conteúdos)</option>
                  <option value="visualizador">Visualizador (Apenas leitura)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
                <Button variant="secondary" size="sm" type="button" onClick={() => setCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Criar Usuário
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
