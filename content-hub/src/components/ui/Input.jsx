import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export function Field({ label, className, children }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-xs font-medium uppercase tracking-widest text-mute">{label}</span>
      )}
      {children}
    </label>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-hairline bg-surface px-4 text-sm text-ink',
        'placeholder:text-faint',
        'transition-colors focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-950/40',
        className,
      )}
      {...props}
    />
  )
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-ink resize-none',
        'placeholder:text-faint',
        'transition-colors focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-950/40',
        className,
      )}
      rows={3}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  // O cn do projeto não faz merge de classes Tailwind: se o chamador pede uma
  // largura (w-44, w-full...), a base não pode impor w-full por cima dela.
  const temLargura = /(^|\s)w-/.test(className || '')
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 rounded-lg border border-hairline bg-surface px-4 text-sm text-ink appearance-none',
        !temLargura && 'w-full',
        'transition-colors focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald-50 dark:focus:ring-emerald-950/40',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23737373\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-10',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})
