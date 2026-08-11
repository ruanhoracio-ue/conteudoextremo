import { useRef, useState } from 'react'
import { Upload, Loader2, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { uploadMedia } from '../../lib/mediaUpload'

/**
 * Botão compacto de upload para o R2 (Cloudflare).
 * Uso: <UploadButton onUploaded={(url) => ...} accept="video/*,image/*" />
 * Mostra progresso durante o envio e chama onUploaded(url) no final.
 */
export function UploadButton({ onUploaded, onError, accept = 'video/*,image/*', className }) {
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null) // null | 0..100
  const [done, setDone] = useState(false)

  async function handleChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reenviar o mesmo arquivo
    if (!file) return

    setDone(false)
    setProgress(0)
    try {
      const { url } = await uploadMedia(file, setProgress)
      setDone(true)
      onUploaded?.(url, file)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      console.error('Upload falhou:', err)
      onError?.(err)
    } finally {
      setProgress(null)
    }
  }

  const uploading = progress !== null

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title="Subir arquivo (armazenado no Cloudflare)"
        className={cn(
          'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-xs font-medium text-mute',
          'transition-colors hover:border-emerald hover:text-emerald',
          'disabled:cursor-wait disabled:opacity-80',
          className,
        )}
      >
        {uploading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {progress}%
          </>
        ) : done ? (
          <>
            <Check size={14} className="text-emerald" />
            Enviado
          </>
        ) : (
          <>
            <Upload size={14} />
            Subir
          </>
        )}
      </button>
    </>
  )
}
