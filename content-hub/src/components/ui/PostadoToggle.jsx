import { cn } from '../../lib/cn'
import { Check } from 'lucide-react'

// Pílula de "postado" das sub-abas de rede social: mesmo formato das pílulas de
// status, mas com dois estados só. Um clique alterna.
export function PostadoToggle({ postado, rede, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={postado}
      disabled={disabled}
      onClick={() => onChange(!postado)}
      title={postado ? `Marcar como não postado no ${rede}` : `Marcar como postado no ${rede}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
        postado
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
          : 'bg-surface text-mute border-hairline hover:border-emerald/50 hover:text-ink',
        disabled && 'opacity-80 cursor-not-allowed',
      )}
    >
      {postado && <Check size={12} strokeWidth={3} />}
      {postado ? 'Postado' : 'Não postado'}
    </button>
  )
}
