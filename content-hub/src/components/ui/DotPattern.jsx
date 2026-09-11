import { useId } from 'react'
import { cn } from '../../lib/cn'

/**
 * Fundo decorativo de pontos (padrão SVG repetido).
 *
 * Posiciona-se em absolute/inset-0, então o container pai precisa ser
 * `relative` (e normalmente `overflow-hidden`), e o conteúdo por cima deve
 * ter `relative z-10`. A cor vai na prop `fill` (uma classe `fill-*`), e não
 * em `className`: o `cn` do projeto não faz merge de classes Tailwind, então
 * um fill no className conviveria com o padrão e venceria só por ordem do
 * CSS. O padrão usa `ink` com opacidade baixa para funcionar nos dois temas.
 * Combine com uma máscara radial para o efeito de "halo" atrás de um
 * elemento central, por exemplo:
 *
 *   <DotPattern fill="fill-ink/15" className="[mask-image:radial-gradient(420px_circle_at_center,white,transparent)]" />
 */
export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  fill = 'fill-ink/10',
  className,
  ...props
}) {
  const id = useId()

  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', fill, className)}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  )
}
