import { useState, useEffect, useMemo, useRef } from 'react'
import {
  KeyRound, Plus, Pencil, Trash2, Copy, Eye, EyeOff, ExternalLink,
  RefreshCw, Loader2, Wand2, Globe, Lock, History, ShieldCheck, ShieldAlert, Check,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import {
  obterStatus, configurarCofre, carregarCofre, salvarCofre, obterVersaoAnterior,
  trocarSenhaMestra, gerarSenha, CofreConflito, CofreNaoAutorizado,
} from '../../lib/cofreApi'
import {
  ITERACOES, bytesAleatorios, paraBase64, deBase64, derivarDaSenha, derivarDaRecuperacao,
  gerarChaveCofre, importarChaveCofre, envelopar, desenvelopar, cifrar, decifrar, hashToken,
  formatarChaveRecuperacao, lerChaveRecuperacao,
} from '../../lib/cofreCrypto'

const SEM_CATEGORIA = 'Sem categoria'
const MIN_SENHA = 10
const INATIVIDADE_MS = 15 * 60 * 1000
const LIMPAR_CLIPBOARD_MS = 30 * 1000

const emptyItem = { nome: '', url: '', categoria: '', login: '', senha: '', observacoes: '' }

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
  try { return new URL(hrefDe(url)).hostname.replace(/^www\./, '') } catch { return url }
}

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

// Copia e, 30 s depois, limpa a área de transferência se ela ainda tiver o
// mesmo valor — para a senha não ficar no histórico do clipboard.
async function copiar(texto, rotulo, { limpar = false } = {}) {
  let ok = false
  try { await navigator.clipboard.writeText(texto); ok = true } catch { ok = copiarLegado(texto) }
  if (!ok) return toast('Não foi possível copiar. Copie manualmente.', 'error')
  toast(limpar ? `${rotulo} copiada — some da área de transferência em 30 s` : `${rotulo} copiado`)
  if (limpar) {
    setTimeout(async () => {
      try {
        if ((await navigator.clipboard.readText()) === texto) await navigator.clipboard.writeText('')
      } catch { /* sem permissão de leitura: não dá para limpar com segurança */ }
    }, LIMPAR_CLIPBOARD_MS)
  }
}

// Com uma KEK (da senha mestra ou da recuperação) e o token correspondente,
// busca o cofre, abre o envelope e decifra os dados.
async function abrirCofre(kek, token) {
  const res = await carregarCofre(token)
  const envelope = res.papel === 'recuperacao' ? res.recuperacao.envelope : res.mestra.envelope
  const chaveCofreBytes = await desenvelopar(kek, envelope)
  const chaveCofre = await importarChaveCofre(chaveCofreBytes)
  const itens = await decifrar(chaveCofre, res.dados)
  return {
    chaveCofre, chaveCofreBytes, token, papel: res.papel,
    versao: res.versao, itens: Array.isArray(itens) ? itens : [],
    historico: res.historico || [], updatedAt: res.updatedAt,
  }
}

export function CofrePage() {
  const [fase, setFase] = useState('carregando') // carregando | configurar | bloqueado | aberto | erro
  const [erroFase, setErroFase] = useState('')
  const [sessao, setSessao] = useState(null)
  const [recuperacaoNova, setRecuperacaoNova] = useState(null)

  async function consultarStatus() {
    setFase('carregando')
    try {
      const st = await obterStatus()
      setFase(st.configurado ? 'bloqueado' : 'configurar')
    } catch (e) {
      setErroFase(e.message || 'Falha ao consultar o cofre.')
      setFase('erro')
    }
  }

  useEffect(() => { consultarStatus() }, [])

  function bloquear(aviso) {
    setSessao(null)
    setRecuperacaoNova(null)
    setFase('bloqueado')
    if (aviso) toast(aviso)
  }

  // Bloqueio automático por inatividade enquanto o cofre estiver aberto.
  useEffect(() => {
    if (fase !== 'aberto') return
    let timer = setTimeout(() => bloquear('Cofre bloqueado por inatividade'), INATIVIDADE_MS)
    const renovar = () => {
      clearTimeout(timer)
      timer = setTimeout(() => bloquear('Cofre bloqueado por inatividade'), INATIVIDADE_MS)
    }
    const eventos = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    eventos.forEach(ev => window.addEventListener(ev, renovar, { passive: true }))
    return () => {
      clearTimeout(timer)
      eventos.forEach(ev => window.removeEventListener(ev, renovar))
    }
  }, [fase])

  if (fase === 'carregando') {
    return <div className="flex items-center justify-center py-24 text-mute"><Loader2 size={22} className="animate-spin" /></div>
  }

  if (fase === 'erro') {
    return (
      <EmptyState icon={KeyRound} title="Não foi possível abrir o cofre" description={erroFase}
        action={<Button variant="secondary" size="sm" onClick={consultarStatus}>Tentar de novo</Button>} />
    )
  }

  if (fase === 'configurar') {
    return (
      <ConfigurarCofre
        onConfigurado={(novaSessao, chaveRec) => { setSessao(novaSessao); setRecuperacaoNova(chaveRec); setFase('aberto') }}
        onJaConfigurado={consultarStatus}
      />
    )
  }

  if (fase === 'bloqueado') {
    return <Desbloquear onAberto={(s) => { setSessao(s); setFase('aberto') }} />
  }

  if (recuperacaoNova) {
    return <MostrarRecuperacao chave={recuperacaoNova} onConfirmar={() => setRecuperacaoNova(null)} />
  }

  return <CofreAberto sessao={sessao} setSessao={setSessao} onBloquear={() => bloquear()} />
}

// ---------------------------------------------------------------------------
// Primeira vez: cria a senha mestra e a chave de recuperação
// ---------------------------------------------------------------------------
function ConfigurarCofre({ onConfigurado, onJaConfigurado }) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < MIN_SENHA) return setErro(`Use pelo menos ${MIN_SENHA} caracteres.`)
    if (senha !== confirma) return setErro('As senhas não conferem.')

    setBusy(true)
    try {
      const chaveCofreBytes = gerarChaveCofre()
      const saltM = bytesAleatorios(16)
      const saltR = bytesAleatorios(16)
      const recBytes = bytesAleatorios(20)

      const mestra = await derivarDaSenha(senha, saltM)
      const recuperacao = await derivarDaRecuperacao(recBytes, saltR)
      const chaveCofre = await importarChaveCofre(chaveCofreBytes)

      const payload = {
        iteracoes: ITERACOES,
        mestra: { salt: paraBase64(saltM), authHash: await hashToken(mestra.token), envelope: await envelopar(mestra.kek, chaveCofreBytes) },
        recuperacao: { salt: paraBase64(saltR), authHash: await hashToken(recuperacao.token), envelope: await envelopar(recuperacao.kek, chaveCofreBytes) },
        dados: await cifrar(chaveCofre, []),
      }
      const res = await configurarCofre(payload)

      onConfigurado({
        chaveCofre, chaveCofreBytes, token: mestra.token, papel: 'mestra',
        versao: res.versao, itens: [], historico: [], updatedAt: res.updatedAt,
      }, formatarChaveRecuperacao(recBytes))
    } catch (e) {
      if (/já foi configurado/i.test(e.message || '')) {
        toast('Outra pessoa acabou de configurar o cofre. Use a senha mestra dela.', 'error')
        onJaConfigurado()
      } else {
        setErro(e.message || 'Falha ao criar o cofre.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald/10 text-emerald"><ShieldCheck size={28} /></div>
        <h1 className="text-heading-lg font-bold text-ink">Criar o cofre da equipe</h1>
        <p className="mt-2 text-sm text-mute">
          Defina a senha mestra. Ela cifra tudo <strong className="text-ink">no seu navegador</strong> — o servidor nunca a recebe
          e nunca vê as senhas guardadas.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-surface p-5">
        <Field label="Senha mestra">
          <div className="flex items-center gap-2">
            <Input type={mostrar ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder={`Mínimo ${MIN_SENHA} caracteres`} autoComplete="new-password" autoFocus className="font-mono" />
            <Button variant="secondary" size="sm" type="button" onClick={() => setMostrar(v => !v)} icon={mostrar ? <EyeOff size={14} /> : <Eye size={14} />} />
          </div>
        </Field>
        <Field label="Confirmar senha mestra">
          <Input type={mostrar ? 'text' : 'password'} value={confirma} onChange={e => setConfirma(e.target.value)} autoComplete="new-password" className="font-mono" />
        </Field>

        {erro && <p className="text-xs text-danger">{erro}</p>}

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-mute">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400"><ShieldAlert size={13} /> Não existe "esqueci a senha"</p>
          Ao criar, você recebe uma <strong className="text-ink">chave de recuperação</strong>, mostrada uma única vez. Guarde as duas em lugar
          seguro: sem elas, o conteúdo do cofre é irrecuperável.
        </div>

        <Button variant="primary" size="md" type="submit" disabled={busy} className="w-full" icon={busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}>
          {busy ? 'Criando o cofre…' : 'Criar cofre'}
        </Button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chave de recuperação — aparece uma única vez
// ---------------------------------------------------------------------------
function MostrarRecuperacao({ chave, onConfirmar }) {
  const [guardei, setGuardei] = useState(false)
  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><ShieldAlert size={28} /></div>
        <h1 className="text-heading-lg font-bold text-ink">Guarde a chave de recuperação</h1>
        <p className="mt-2 text-sm text-mute">
          Ela abre o cofre se a senha mestra for esquecida e permite definir uma nova. <strong className="text-ink">Esta é a única vez que ela aparece.</strong>
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-hairline bg-surface p-5">
        <div className="select-all rounded-lg border border-hairline bg-elevated/50 p-4 text-center font-mono text-lg tracking-wider text-ink">
          {chave}
        </div>
        <Button variant="secondary" size="sm" type="button" className="w-full" onClick={() => copiar(chave, 'Chave de recuperação')} icon={<Copy size={14} />}>
          Copiar chave
        </Button>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={guardei} onChange={e => setGuardei(e.target.checked)} className="mt-0.5 accent-emerald-500" />
          Guardei a chave em um lugar seguro, fora deste app (gerenciador de senhas pessoal ou papel).
        </label>
        <Button variant="primary" size="md" type="button" className="w-full" disabled={!guardei} onClick={onConfirmar} icon={<Check size={16} />}>
          Entrar no cofre
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cofre bloqueado: senha mestra ou chave de recuperação
// ---------------------------------------------------------------------------
function Desbloquear({ onAberto }) {
  const [status, setStatus] = useState(null)
  const [modo, setModo] = useState('senha') // senha | recuperacao
  const [senha, setSenha] = useState('')
  const [chaveRec, setChaveRec] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    obterStatus().then(setStatus).catch(e => setErro(e.message || 'Falha ao consultar o cofre.'))
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!status) return
    setErro('')
    setBusy(true)
    try {
      let derivado
      if (modo === 'senha') {
        if (!senha) return setErro('Digite a senha mestra.')
        derivado = await derivarDaSenha(senha, deBase64(status.mestra.salt), status.iteracoes)
      } else {
        const bytes = lerChaveRecuperacao(chaveRec)
        if (!bytes) return setErro('Chave de recuperação inválida. Confira os 32 caracteres.')
        derivado = await derivarDaRecuperacao(bytes, deBase64(status.recuperacao.salt))
      }
      const s = await abrirCofre(derivado.kek, derivado.token)
      setSenha('')
      setChaveRec('')
      onAberto(s)
    } catch (err) {
      if (err instanceof CofreNaoAutorizado) setErro(modo === 'senha' ? 'Senha mestra incorreta.' : 'Chave de recuperação incorreta.')
      else setErro(err.message || 'Não foi possível abrir o cofre.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald/10 text-emerald"><Lock size={28} /></div>
        <h1 className="text-heading-lg font-bold text-ink">Cofre de Senhas</h1>
        <p className="mt-2 text-sm text-mute">Bloqueado. As senhas só são decifradas aqui, no seu navegador.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-surface p-5">
        {modo === 'senha' ? (
          <Field label="Senha mestra">
            <div className="flex items-center gap-2">
              <Input type={mostrar ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" autoFocus className="font-mono" />
              <Button variant="secondary" size="sm" type="button" onClick={() => setMostrar(v => !v)} icon={mostrar ? <EyeOff size={14} /> : <Eye size={14} />} />
            </div>
          </Field>
        ) : (
          <Field label="Chave de recuperação">
            <Input value={chaveRec} onChange={e => setChaveRec(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoComplete="off" autoFocus className="font-mono uppercase" />
          </Field>
        )}

        {erro && <p className="text-xs text-danger">{erro}</p>}

        <Button variant="primary" size="md" type="submit" disabled={busy || !status} className="w-full" icon={busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}>
          {busy ? 'Abrindo o cofre…' : 'Abrir cofre'}
        </Button>

        <button type="button" onClick={() => { setModo(m => m === 'senha' ? 'recuperacao' : 'senha'); setErro('') }} className="w-full text-center text-xs text-mute underline-offset-2 hover:text-ink hover:underline">
          {modo === 'senha' ? 'Esqueci a senha — usar a chave de recuperação' : 'Voltar para a senha mestra'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cofre aberto
// ---------------------------------------------------------------------------
function CofreAberto({ sessao, setSessao, onBloquear }) {
  const [salvando, setSalvando] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [revelados, setRevelados] = useState(() => new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [trocaOpen, setTrocaOpen] = useState(sessao.papel === 'recuperacao')
  const [historicoOpen, setHistoricoOpen] = useState(false)

  const { itens, versao, chaveCofre, token } = sessao

  // Ao sair da aba, esconde qualquer senha que estivesse revelada.
  useEffect(() => {
    const onVis = () => { if (document.hidden) setRevelados(new Set()) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  async function salvar(novosItens) {
    setSalvando(true)
    try {
      const dados = await cifrar(chaveCofre, novosItens)
      const res = await salvarCofre(token, versao, dados)
      setSessao(s => ({ ...s, itens: novosItens, versao: res.versao, historico: res.historico || [], updatedAt: res.updatedAt }))
      return true
    } catch (e) {
      if (e instanceof CofreConflito) {
        try {
          const atuais = await decifrar(chaveCofre, e.atual.dados)
          setSessao(s => ({ ...s, itens: Array.isArray(atuais) ? atuais : [], versao: e.atual.versao, historico: e.atual.historico || [], updatedAt: e.atual.updatedAt }))
          toast('Alguém alterou o cofre. Recarreguei — confira e tente de novo.', 'error')
        } catch {
          toast('O cofre mudou e não consegui recarregar. Bloqueie e abra de novo.', 'error')
        }
      } else if (e instanceof CofreNaoAutorizado) {
        toast('Sua sessão do cofre expirou (a senha mestra foi trocada?). Abra de novo.', 'error')
        onBloquear()
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
      return [i.nome, i.url, i.login, i.categoria, i.observacoes].some(v => (v || '').toLowerCase().includes(s))
    })
  }, [itens, search, filtroCat])

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
    return nomes.map(nome => ({ nome, itens: mapa.get(nome).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) }))
  }, [filtrados])

  function toggleRevelar(id) {
    setRevelados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(item) { setEditing(item); setModalOpen(true) }

  async function handleSave(form) {
    const agora = new Date().toISOString()
    const novos = editing
      ? itens.map(i => i.id === editing.id ? { ...i, ...form, updatedAt: agora } : i)
      : [{ ...form, id: crypto.randomUUID(), createdAt: agora, updatedAt: agora }, ...itens]
    if (await salvar(novos)) {
      toast(editing ? 'Credencial atualizada' : 'Credencial adicionada')
      setModalOpen(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (await salvar(itens.filter(i => i.id !== deleteTarget.id))) toast('Credencial excluída')
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-ink font-bold flex items-center gap-2">
            <KeyRound className="text-emerald" size={24} /> Cofre de Senhas
          </h1>
          <p className="text-sm text-mute mt-1">Logins e senhas da equipe — cifrados no navegador, o servidor só guarda o embaralhado</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHistoricoOpen(true)} icon={<History size={14} />} title="Versões anteriores">Histórico</Button>
          <Button variant="ghost" size="sm" onClick={() => setTrocaOpen(true)} icon={<ShieldCheck size={14} />}>Senha mestra</Button>
          <Button variant="secondary" size="sm" onClick={onBloquear} icon={<Lock size={14} />}>Bloquear</Button>
          <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>Nova credencial</Button>
        </div>
      </div>

      {sessao.papel === 'recuperacao' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <ShieldAlert size={14} /> Você entrou com a chave de recuperação. Defina uma nova senha mestra agora.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por site, login, categoria..." className="w-72" />
        <Select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className="w-44 !h-10">
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        {itens.length > 0 && (
          <span className="text-xs text-mute">
            {filtrados.length === itens.length ? `${itens.length} ${itens.length === 1 ? 'credencial' : 'credenciais'}` : `${filtrados.length} de ${itens.length}`}
          </span>
        )}
      </div>

      {itens.length === 0 ? (
        <EmptyState icon={KeyRound} title="O cofre está vazio" description="Adicione o primeiro login de um site ou software da equipe."
          action={<Button variant="primary" size="sm" onClick={openAdd} icon={<Plus size={16} />}>Nova credencial</Button>} />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={KeyRound} title="Nada encontrado" description="Ajuste a busca ou o filtro de categoria." />
      ) : (
        <div className="space-y-8">
          {grupos.map(grupo => (
            <section key={grupo.nome}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                {grupo.nome} <span className="text-xs font-normal text-mute">({grupo.itens.length})</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {grupo.itens.map(item => (
                  <CredencialCard key={item.id} item={item} revelada={revelados.has(item.id)}
                    onRevelar={() => toggleRevelar(item.id)} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar credencial' : 'Nova credencial'} size="md">
        <CredencialForm initialData={editing} categorias={categorias} salvando={salvando} onSave={handleSave} onClose={() => setModalOpen(false)} />
      </Modal>

      <Modal isOpen={trocaOpen} onClose={() => setTrocaOpen(false)} title="Trocar a senha mestra" size="sm">
        <TrocarSenhaForm sessao={sessao} setSessao={setSessao} onClose={() => setTrocaOpen(false)} />
      </Modal>

      <Modal isOpen={historicoOpen} onClose={() => setHistoricoOpen(false)} title="Versões anteriores do cofre" size="md">
        <HistoricoPainel sessao={sessao} salvar={salvar} onClose={() => setHistoricoOpen(false)} />
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Excluir credencial?" message={`"${deleteTarget?.nome}" será removida do cofre. Ela continua disponível no histórico por algumas versões.`} />
    </div>
  )
}

function TrocarSenhaForm({ sessao, setSessao, onClose }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const pedeAtual = sessao.papel === 'mestra'

  async function submit(e) {
    e.preventDefault()
    setErro('')
    if (nova.length < MIN_SENHA) return setErro(`Use pelo menos ${MIN_SENHA} caracteres.`)
    if (nova !== confirma) return setErro('As senhas não conferem.')
    setBusy(true)
    try {
      const st = await obterStatus()
      if (pedeAtual) {
        const check = await derivarDaSenha(atual, deBase64(st.mestra.salt), st.iteracoes)
        if (check.token !== sessao.token) return setErro('Senha mestra atual incorreta.')
      }
      const saltM = bytesAleatorios(16)
      const m = await derivarDaSenha(nova, saltM, ITERACOES)
      const mestra = { salt: paraBase64(saltM), authHash: await hashToken(m.token), envelope: await envelopar(m.kek, sessao.chaveCofreBytes) }
      await trocarSenhaMestra(sessao.token, mestra)
      setSessao(s => ({ ...s, token: m.token, papel: 'mestra' }))
      toast('Senha mestra trocada. A chave de recuperação continua a mesma.')
      onClose()
    } catch (err) {
      setErro(err.message || 'Falha ao trocar a senha mestra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {pedeAtual && (
        <Field label="Senha mestra atual">
          <Input type="password" value={atual} onChange={e => setAtual(e.target.value)} autoComplete="current-password" autoFocus className="font-mono" />
        </Field>
      )}
      <Field label="Nova senha mestra">
        <Input type="password" value={nova} onChange={e => setNova(e.target.value)} placeholder={`Mínimo ${MIN_SENHA} caracteres`} autoComplete="new-password" autoFocus={!pedeAtual} className="font-mono" />
      </Field>
      <Field label="Confirmar nova senha">
        <Input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} autoComplete="new-password" className="font-mono" />
      </Field>
      {erro && <p className="text-xs text-danger">{erro}</p>}
      <p className="text-xs text-mute">A senha antiga deixa de funcionar na hora. Quem estiver com o cofre aberto em outro computador precisará abrir de novo.</p>
      <div className="flex justify-end gap-3 border-t border-hairline pt-4">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" type="submit" disabled={busy} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}>Trocar senha</Button>
      </div>
    </form>
  )
}

function HistoricoPainel({ sessao, salvar, onClose }) {
  const [aberta, setAberta] = useState(null) // { versao, itens }
  const [busy, setBusy] = useState(false)
  const historico = sessao.historico || []

  async function ver(v) {
    setBusy(true)
    try {
      const res = await obterVersaoAnterior(sessao.token, v.versao)
      const itens = await decifrar(sessao.chaveCofre, res.dados)
      setAberta({ versao: v.versao, updatedAt: v.updatedAt, itens: Array.isArray(itens) ? itens : [] })
    } catch (e) {
      toast(e.message || 'Não foi possível abrir essa versão.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function restaurar() {
    if (!aberta) return
    setBusy(true)
    const ok = await salvar(aberta.itens)
    setBusy(false)
    if (ok) { toast(`Versão ${aberta.versao} restaurada como uma versão nova`); onClose() }
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : ''

  if (aberta) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-mute">Versão <strong className="text-ink">{aberta.versao}</strong> · {fmt(aberta.updatedAt)} · {aberta.itens.length} {aberta.itens.length === 1 ? 'credencial' : 'credenciais'}</p>
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-hairline bg-elevated/40 p-3 text-sm">
          {aberta.itens.length === 0 && <li className="text-faint">— vazio —</li>}
          {aberta.itens.map(i => <li key={i.id} className="truncate text-ink">{i.nome}{i.login ? <span className="text-mute"> · {i.login}</span> : null}</li>)}
        </ul>
        <p className="text-xs text-mute">Restaurar cria uma versão nova com este conteúdo — a atual vai para o histórico, nada é apagado.</p>
        <div className="flex justify-end gap-3 border-t border-hairline pt-4">
          <Button variant="ghost" size="sm" type="button" onClick={() => setAberta(null)}>Voltar</Button>
          <Button variant="primary" size="sm" type="button" disabled={busy} onClick={restaurar} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}>Restaurar esta versão</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-mute">Versão atual: <strong className="text-ink">{sessao.versao}</strong>. O cofre guarda as últimas {10} versões anteriores, cifradas.</p>
      {historico.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-elevated/40 p-4 text-center text-sm text-faint">Ainda não há versões anteriores.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {historico.map(v => (
            <li key={v.versao} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-ink">Versão {v.versao} <span className="text-mute">· {fmt(v.updatedAt)}</span></span>
              <Button variant="ghost" size="xs" type="button" disabled={busy} onClick={() => ver(v)}>Ver</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end border-t border-hairline pt-4">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  )
}

function CredencialCard({ item, revelada, onRevelar, onEdit, onDelete }) {
  const host = hostDe(item.url)
  const inicial = (item.nome || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="group rounded-xl border border-hairline bg-surface p-4 transition-all duration-fast hover:border-hairline-strong hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold', corDe(item.nome))}>{inicial}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-ink">{item.nome}</p>
            {item.url && (
              <a href={hrefDe(item.url)} target="_blank" rel="noreferrer" title={`Abrir ${host}`} className="shrink-0 text-faint transition-colors hover:text-emerald"><ExternalLink size={13} /></a>
            )}
          </div>
          {host && <p className="flex items-center gap-1 truncate text-xs text-mute"><Globe size={11} className="shrink-0" /> {host}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={onEdit} className="rounded-md p-1.5 text-mute transition-colors hover:bg-ink/5 hover:text-ink" title="Editar"><Pencil size={14} /></button>
          <button onClick={onDelete} className="rounded-md p-1.5 text-mute transition-colors hover:bg-danger/5 hover:text-danger" title="Excluir"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Linha rotulo="Login" valor={item.login} />
        <Linha rotulo="Senha" valor={item.senha} secreta revelada={revelada} onRevelar={onRevelar} />
      </div>
      {item.observacoes && <p className="mt-3 line-clamp-2 text-xs text-mute" title={item.observacoes}>{item.observacoes}</p>}
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
        <button onClick={() => copiar(valor, rotulo, { limpar: secreta })} className="shrink-0 rounded p-1 text-mute transition-colors hover:text-emerald" title={`Copiar ${rotulo.toLowerCase()}`}>
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
        <Field label="URL"><Input value={form.url} onChange={e => set('url', e.target.value)} placeholder="app.exemplo.com" /></Field>
        <Field label="Categoria">
          <Input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex.: Tráfego, IAs, Redes" list="cofre-categorias" />
          <datalist id="cofre-categorias">{categorias.map(c => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <Field label="Login / e-mail"><Input value={form.login} onChange={e => set('login', e.target.value)} placeholder="usuario@empresa.com" autoComplete="off" /></Field>
      <Field label="Senha">
        <div className="flex items-center gap-2">
          <Input type={mostrarSenha ? 'text' : 'password'} value={form.senha} onChange={e => set('senha', e.target.value)} placeholder="••••••••" autoComplete="new-password" className="font-mono" />
          <Button variant="secondary" size="sm" type="button" onClick={() => setMostrarSenha(v => !v)} icon={mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />} title={mostrarSenha ? 'Ocultar' : 'Mostrar'} />
          <Button variant="secondary" size="sm" type="button" onClick={() => { set('senha', gerarSenha()); setMostrarSenha(true) }} icon={<Wand2 size={14} />}>Gerar</Button>
        </div>
      </Field>
      <Field label="Observações">
        <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Pergunta de segurança, quem é o dono da conta, 2FA no celular de quem..." rows={3} />
      </Field>
      <div className="flex justify-end gap-3 border-t border-hairline pt-4">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" type="submit" disabled={salvando} icon={salvando ? <Loader2 size={14} className="animate-spin" /> : undefined}>{initialData ? 'Salvar' : 'Adicionar'}</Button>
      </div>
    </form>
  )
}
