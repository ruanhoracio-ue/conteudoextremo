import { useState, useEffect, useMemo } from 'react'
import {
  KeyRound, Plus, Pencil, Trash2, Copy, Eye, EyeOff, ExternalLink,
  RefreshCw, Loader2, Wand2, Globe,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { carregarCofre, salvarCofre, CofreConflito, gerarSenha } from '../../lib/cofreApi'

const SEM_CATEGORIA = 'Sem categoria'

const emptyItem = {
  nome: '', url: '', categoria: '', login: '', senha: '', observacoes: '',
}

// Cor do avatar derivada do nome, para cada site ter sempre a mesma.
const CORES = [
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
]

function corDe(nome) {
  let h = 0
  for (const ch of nome || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CORES[h % CORES.length]
}

function hrefDe(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function hostDe(url) {
  if (!url) return ''
  try {
    return new URL(hrefDe(url)).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Fallback para navegadores sem a Clipboard API (ou com ela bloqueada):
// seleciona o texto num campo fora da tela e usa o comando de copiar.
function copiarLegado(texto) {
  const ta = document.createElement('textarea')
  ta.value = texto
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return ok
}

async function copiar(texto, rotulo) {
  try {
    await navigator.clipboard.writeText(texto)
    toast(`${rotulo} copiado`)
    return
  } catch {
    // cai no fallback
  }
  if (copiarLegado(texto)) toast(`${rotulo} copiado`)
  else toast('Não foi possível copiar. Copie manualmente.', 'error')
}

export function CofrePage() {
  const [itens, setItens] = useState([])
  const [versao, setVersao] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [search, setSearch] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [revelados, setRevelados] = useState(() => new Set())

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      const data = await carregarCofre()
      setItens(data.itens || [])
      setVersao(data.versao || 0)
    } catch (e) {
      setErro(e.message || 'Falha ao carregar o cofre.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  // Salva a lista inteira; se alguém salvou antes, recarrega e avisa.
  async function salvar(novosItens) {
    setSalvando(true)
    try {
      const res = await salvarCofre(versao, novosItens)
      setItens(res.itens)
      setVersao(res.versao)
      return true
    } catch (e) {
      if (e instanceof CofreConflito) {
        setItens(e.atual.itens || [])
        setVersao(e.atual.versao || 0)
        toast('Alguém alterou o cofre. Recarreguei — confira e tente de novo.', 'error')
      } else {
        toast(e.message || 'Falha ao salvar o cofre.', 'error')
      }
      return false
    } finally {
      setSalvando(false)
    }
  }

  const categorias = useMemo(
    () => [...new Set(itens.map(i => (i.categoria || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [itens],
  )

  const filtrados = useMemo(() => {
    const s = search.trim().toLowerCase()
    return itens.filter(i => {
      if (filtroCat && (i.categoria || '').trim() !== filtroCat) return false
      if (!s) return true
      return [i.nome, i.url, i.login, i.categoria, i.observacoes]
        .some(v => (v || '').toLowerCase().includes(s))
    })
  }, [itens, search, filtroCat])

  // Agrupa por categoria, "Sem categoria" por último.
  const grupos = useMemo(() => {
    const mapa = new Map()
    for (const item of filtrados) {
      const cat = (item.categoria || '').trim() || SEM_CATEGORIA
      if (!mapa.has(cat)) mapa.set(cat, [])
      mapa.get(cat).push(item)
    }
    const nomes = [...mapa.keys()].sort((a, b) => {
      if (a === SEM_CATEGORIA) return 1
      if (b === SEM_CATEGORIA) return -1
      return a.localeCompare(b)
    })
    return nomes.map(nome => ({
      nome,
      itens: mapa.get(nome).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
    }))
  }, [filtrados])

  function toggleRevelar(id) {
    setRevelados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setModalOpen(true) }

  async function handleSave(form) {
    const agora = new Date().toISOString()
    let novos
    if (editing) {
      novos = itens.map(i => i.id === editing.id ? { ...i, ...form, updatedAt: agora } : i)
    } else {
      novos = [{ ...form, id: crypto.randomUUID(), createdAt: agora, updatedAt: agora }, ...itens]
    }
    const ok = await salvar(novos)
    if (ok) {
      toast(editing ? 'Credencial atualizada' : 'Credencial adicionada')
      setModalOpen(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const ok = await salvar(itens.filter(i => i.id !== deleteTarget.id))
    if (ok) toast('Credencial excluída')
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-ink font-bold flex items-center gap-2">
            <KeyRound className="text-emerald" size={24} /> Cofre de Senhas
          </h1>
          <p className="text-sm text-mute mt-1">
            Logins e senhas dos sites e softwares que a equipe usa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={carregar} disabled={loading} icon={<RefreshCw size={14} className={cn(loading && 'animate-spin')} />}>
            Recarregar
          </Button>
          <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>
            Nova credencial
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por site, login, categoria..." className="w-72" />
        <Select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className="w-44 !h-10">
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        {itens.length > 0 && (
          <span className="text-xs text-mute">
            {filtrados.length === itens.length
              ? `${itens.length} ${itens.length === 1 ? 'credencial' : 'credenciais'}`
              : `${filtrados.length} de ${itens.length}`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-mute">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : erro ? (
        <EmptyState
          icon={KeyRound}
          title="Não foi possível abrir o cofre"
          description={erro}
          action={<Button variant="secondary" size="sm" onClick={carregar}>Tentar de novo</Button>}
        />
      ) : itens.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="O cofre está vazio"
          description="Adicione o primeiro login de um site ou software da equipe."
          action={<Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>Nova credencial</Button>}
        />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={KeyRound} title="Nada encontrado" description="Ajuste a busca ou o filtro de categoria." />
      ) : (
        <div className="space-y-8">
          {grupos.map(grupo => (
            <section key={grupo.nome}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                {grupo.nome}
                <span className="text-xs font-normal text-mute">({grupo.itens.length})</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {grupo.itens.map(item => (
                  <CredencialCard
                    key={item.id}
                    item={item}
                    revelada={revelados.has(item.id)}
                    onRevelar={() => toggleRevelar(item.id)}
                    onEdit={() => openEdit(item)}
                    onDelete={() => setDeleteTarget(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar credencial' : 'Nova credencial'} size="md">
        <CredencialForm
          initialData={editing}
          categorias={categorias}
          salvando={salvando}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir credencial?"
        message={`"${deleteTarget?.nome}" será removida do cofre permanentemente.`}
      />
    </div>
  )
}

function CredencialCard({ item, revelada, onRevelar, onEdit, onDelete }) {
  const host = hostDe(item.url)
  const inicial = (item.nome || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="group rounded-xl border border-hairline bg-surface p-4 transition-all duration-fast hover:border-hairline-strong hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold', corDe(item.nome))}>
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-ink">{item.nome}</p>
            {item.url && (
              <a
                href={hrefDe(item.url)}
                target="_blank"
                rel="noreferrer"
                title={`Abrir ${host}`}
                className="shrink-0 text-faint transition-colors hover:text-emerald"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {host && (
            <p className="flex items-center gap-1 truncate text-xs text-mute">
              <Globe size={11} className="shrink-0" /> {host}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={onEdit} className="rounded-md p-1.5 text-mute transition-colors hover:bg-ink/5 hover:text-ink" title="Editar">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="rounded-md p-1.5 text-mute transition-colors hover:bg-danger/5 hover:text-danger" title="Excluir">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Linha rotulo="Login" valor={item.login} />
        <Linha rotulo="Senha" valor={item.senha} secreta revelada={revelada} onRevelar={onRevelar} />
      </div>

      {item.observacoes && (
        <p className="mt-3 line-clamp-2 text-xs text-mute" title={item.observacoes}>{item.observacoes}</p>
      )}
    </div>
  )
}

function Linha({ rotulo, valor, secreta = false, revelada = false, onRevelar }) {
  const vazio = !valor
  const exibido = vazio ? '—' : secreta && !revelada ? '••••••••••••' : valor

  return (
    <div className="flex items-center gap-2 rounded-lg bg-elevated/50 px-2.5 py-1.5">
      <span className="w-11 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-faint">{rotulo}</span>
      <span className={cn('min-w-0 flex-1 truncate font-mono text-xs', vazio ? 'text-faint' : 'text-ink')}>{exibido}</span>
      {!vazio && secreta && (
        <button onClick={onRevelar} className="shrink-0 rounded p-1 text-mute transition-colors hover:text-ink" title={revelada ? 'Ocultar' : 'Mostrar'}>
          {revelada ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}
      {!vazio && (
        <button onClick={() => copiar(valor, rotulo)} className="shrink-0 rounded p-1 text-mute transition-colors hover:text-emerald" title={`Copiar ${rotulo.toLowerCase()}`}>
          <Copy size={13} />
        </button>
      )}
    </div>
  )
}

function CredencialForm({ initialData, categorias, salvando, onSave, onClose }) {
  const [form, setForm] = useState(() => initialData ? { ...emptyItem, ...initialData } : emptyItem)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }))

  function submit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const { id, createdAt, updatedAt, ...campos } = form
    onSave(Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, (v || '').trim()])))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Site ou software">
        <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Meta Ads, Canva, Google Drive" required autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="URL">
          <Input value={form.url} onChange={e => set('url', e.target.value)} placeholder="app.exemplo.com" />
        </Field>
        <Field label="Categoria">
          <Input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex.: Tráfego, IAs, Redes" list="cofre-categorias" />
          <datalist id="cofre-categorias">
            {categorias.map(c => <option key={c} value={c} />)}
          </datalist>
        </Field>
      </div>

      <Field label="Login / e-mail">
        <Input value={form.login} onChange={e => set('login', e.target.value)} placeholder="usuario@empresa.com" autoComplete="off" />
      </Field>

      <Field label="Senha">
        <div className="flex items-center gap-2">
          <Input
            type={mostrarSenha ? 'text' : 'password'}
            value={form.senha}
            onChange={e => set('senha', e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="font-mono"
          />
          <Button variant="secondary" size="sm" type="button" onClick={() => setMostrarSenha(v => !v)} icon={mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />} title={mostrarSenha ? 'Ocultar' : 'Mostrar'} />
          <Button variant="secondary" size="sm" type="button" onClick={() => { set('senha', gerarSenha()); setMostrarSenha(true) }} icon={<Wand2 size={14} />}>
            Gerar
          </Button>
        </div>
      </Field>

      <Field label="Observações">
        <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Pergunta de segurança, quem é o dono da conta, 2FA no celular de quem..." rows={3} />
      </Field>

      <div className="flex justify-end gap-3 border-t border-hairline pt-4">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" type="submit" disabled={salvando} icon={salvando ? <Loader2 size={14} className="animate-spin" /> : undefined}>
          {initialData ? 'Salvar' : 'Adicionar'}
        </Button>
      </div>
    </form>
  )
}
