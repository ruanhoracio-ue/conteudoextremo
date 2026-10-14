import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

/**
 * Button — pílula do design system da Conversão Extrema.
 * Variantes: shiny | shiny-brand | primary | secondary | ghost | brand
 */

const base =
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium leading-none tracking-tight whitespace-nowrap select-none transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

const sizes = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
  field: 'h-[var(--ds-input-height)] px-4 text-xs',
}

const variants = {
  shiny: 'shiny-cta hover:-translate-y-0.5 transform-gpu',
  'shiny-brand': 'shiny-brand hover:-translate-y-0.5 transform-gpu',
  // verde chapado: o botão principal da referência, sem borda girando nem fundo preto
  primary: 'bg-emerald text-white shadow-sm hover:bg-emerald-deep hover:-translate-y-0.5 transform-gpu',
  // 'brand' nunca teve CSS (.shiny-brand não existe): ficava texto branco sem fundo,
  // invisível em modal claro. Passa a ser o mesmo verde chapado do primary.
  brand: 'bg-emerald text-white shadow-sm hover:bg-emerald-deep hover:-translate-y-0.5 transform-gpu',
  secondary:
    'ds-btn-secondary bg-surface text-ink border border-hairline hover:bg-elevated hover:-translate-y-0.5 transform-gpu shadow-xs',
  ghost: 'bg-transparent text-ink hover:bg-ink/10',
  danger: 'bg-danger text-white hover:bg-red-600 shadow-sm',
}

export const Button = forwardRef(function Button(
  { as: Tag = 'button', variant = 'primary', size = 'sm', className, children, icon, ...props },
  ref,
) {
  const isShiny = variant === 'shiny' || variant === 'shiny-brand'

  const content = (
    <>
      {children}
      {icon && (
        <span className="ml-1 transition-transform group-hover:translate-x-0.5">{icon}</span>
      )}
    </>
  )

  return (
    <Tag ref={ref} className={cn(base, variants[variant] || variants.primary, sizes[size] || sizes.sm, className)} {...props}>
      {isShiny ? (
        <>
          <span className="shiny-dots" aria-hidden="true" />
          <span className="shiny-cta-content">{content}</span>
        </>
      ) : (
        content
      )}
    </Tag>
  )
})

export function ButtonIconBadge({ as: Tag = 'button', className, children, icon, ...props }) {
  return (
    <Button as={Tag} variant="shiny" className={className} icon={icon} {...props}>
      {children}
    </Button>
  )
}
