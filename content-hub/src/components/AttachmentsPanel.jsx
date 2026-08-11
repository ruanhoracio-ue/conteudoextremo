import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, FileVideo, FileImage, File as FileIcon, Trash2, Download, Loader2, Play } from 'lucide-react'
import { cn } from '../lib/cn'
import { uploadMedia, deleteMedia, listMedia } from '../lib/mediaUpload'
import { toast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'

function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function iconFor(contentType) {
  if (contentType?.startsWith('video/')) return FileVideo
  if (contentType?.startsWith('image/')) return FileImage
  return FileIcon
}

/**
 * Painel de anexos estilo ClickUp: arraste arquivos (ou clique) para anexar
 * ao item. Os arquivos ficam no R2 sob anexos/<itemType>/<itemId>/.
 *
 * Uso: <AttachmentsPanel itemType="videosLongos" itemId={item.id} />
 */
export function AttachmentsPanel({ itemType, itemId, className }) {
  const prefix = `${itemType}/${itemId}`
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState([]) // [{name, progress}]
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [preview, setPreview] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setFiles(await listMedia(prefix))
    } catch (e) {
      console.error('Erro ao listar anexos:', e)
    } finally {
      setLoading(false)
    }
  }, [prefix])

  useEffect(() => { refresh() }, [refresh])

  async function handleFiles(fileList) {
    const selected = Array.from(fileList || [])
    if (!selected.length) return

    for (const file of selected) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setUploads(prev => [...prev, { id, name: file.name, progress: 0 }])
      try {
        await uploadMedia(
          file,
          (p) => setUploads(prev => prev.map(u => (u.id === id ? { ...u, progress: p } : u))),
          prefix,
        )
        toast(`"${file.name}" anexado!`)
      } catch (err) {
        console.error('Upload falhou:', err)
        toast(`Falha ao enviar "${file.name}"`)
      } finally {
        setUploads(prev => prev.filter(u => u.id !== id))
      }
    }
    refresh()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteMedia(confirmDelete.key)
      toast('Anexo excluído')
      setFiles(prev => prev.filter(f => f.key !== confirmDelete.key))
    } catch (e) {
      toast('Falha ao excluir anexo')
    }
    setConfirmDelete(null)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-mute">
          Anexos {files.length > 0 && <span className="text-emerald">({files.length})</span>}
        </span>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver
            ? 'border-emerald bg-emerald-50/50 dark:bg-emerald-950/20'
            : 'border-hairline bg-elevated/40 hover:border-emerald/60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />
        <UploadCloud size={22} className={cn('transition-colors', dragOver ? 'text-emerald' : 'text-mute')} />
        <p className="text-sm text-body">
          <span className="font-medium text-emerald">Clique para subir</span> ou arraste arquivos aqui
        </p>
        <p className="text-[11px] text-faint">Vídeos, imagens e outros arquivos — salvos no Cloudflare</p>
      </div>

      {/* Uploads em andamento */}
      {uploads.map((u, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2">
          <Loader2 size={16} className="shrink-0 animate-spin text-emerald" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink">{u.name}</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
              <div className="h-full rounded-full bg-emerald transition-all" style={{ width: `${u.progress}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-mute">{u.progress}%</span>
        </div>
      ))}

      {/* Lista de anexos */}
      {loading ? (
        <p className="text-xs text-faint">Carregando anexos…</p>
      ) : files.length === 0 && uploads.length === 0 ? null : (
        <ul className="space-y-1.5">
          {files.map((f) => {
            const Icon = iconFor(f.contentType)
            const isVideo = f.contentType?.startsWith('video/')
            const isImage = f.contentType?.startsWith('image/')
            return (
              <li key={f.key} className="group flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2">
                {isImage ? (
                  <button type="button" onClick={() => setPreview(f)} title="Visualizar" className="shrink-0">
                    <img src={f.url} alt="" className="h-12 w-12 rounded-md object-cover" loading="lazy" />
                  </button>
                ) : isVideo ? (
                  <button
                    type="button"
                    onClick={() => setPreview(f)}
                    title="Assistir"
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/60"
                  >
                    {/* preload=metadata + #t=0.1 pinta o primeiro frame sem baixar o vídeo todo */}
                    <video
                      src={`${f.url}#t=0.1`}
                      preload="metadata"
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Play size={14} className="text-white drop-shadow" fill="currentColor" />
                    </span>
                  </button>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-elevated text-mute">
                    <Icon size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink" title={f.name}>{f.name}</p>
                  <p className="text-[11px] text-faint">
                    {formatSize(f.size)} · {new Date(f.uploaded).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  {(isVideo || isImage) && (
                    <button
                      type="button"
                      title={isVideo ? 'Assistir' : 'Visualizar'}
                      onClick={() => setPreview(f)}
                      className="rounded-md p-1.5 text-mute transition-colors hover:bg-ink/5 hover:text-emerald"
                    >
                      <Play size={14} />
                    </button>
                  )}
                  <a
                    href={f.url}
                    download={f.name}
                    title="Baixar"
                    className="rounded-md p-1.5 text-mute transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    type="button"
                    title="Excluir"
                    onClick={() => setConfirmDelete(f)}
                    className="rounded-md p-1.5 text-mute transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Preview de vídeo/imagem */}
      {preview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {preview.contentType?.startsWith('video/') ? (
              <video src={preview.url} controls autoPlay className="max-h-[80vh] w-full rounded-xl" />
            ) : (
              <img src={preview.url} alt={preview.name} className="max-h-[80vh] w-full rounded-xl object-contain" />
            )}
            <p className="mt-2 text-center text-xs text-white/70">{preview.name} — clique fora para fechar</p>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir anexo"
        message={`Excluir "${confirmDelete?.name}"? Essa ação não pode ser desfeita.`}
      />
    </div>
  )
}
