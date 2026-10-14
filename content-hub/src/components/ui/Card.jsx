import { cn } from '../../lib/cn'

const variants = {
  flat: 'rounded-2xl border border-hairline bg-surface shadow-xs',
  premium: 'premium-card',
}

export function Card({ variant = 'flat', className, children, ...props }) {
  return (
    <div className={cn(variants[variant], 'p-6', className)} {...props}>
      {children}
    </div>
  )
}
