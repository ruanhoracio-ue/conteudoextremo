import { cn } from '../../lib/cn'
import { statusOf } from '../../lib/stageStatus'

// Mesmas cores usadas no status dos Criativos: verde para o fim do fluxo,
// azul e âmbar para o meio, neutro para quem ainda não começou.
const TONES = {
  publicado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  aprovado: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  editado: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  gravado: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
}
const FILA_TONE = 'bg-surface text-mute border-hairline'

export function StageStatusSelect({ item, stages, labels, onChange, disabled = false }) {
  const current = statusOf(item, stages)

  return (
    <select
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
        TONES[current] || FILA_TONE,
        disabled && 'opacity-80 cursor-not-allowed',
      )}
    >
      <option value="">Fila</option>
      {stages.map((s) => <option key={s} value={s}>{labels[s]}</option>)}
    </select>
  )
}
