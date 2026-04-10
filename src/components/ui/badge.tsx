import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--primary)] text-[var(--primary-fg)]',
        secondary:
          'border-transparent bg-[var(--secondary-light)] text-[var(--foreground)]',
        success:
          'border-transparent bg-[var(--success-light)] text-[var(--success)]',
        warning:
          'border-transparent bg-[var(--warning-light)] text-[var(--warning)]',
        destructive:
          'border-transparent bg-[var(--destructive-light)] text-[var(--destructive)]',
        outline:
          'border-[var(--border-strong)] bg-transparent text-[var(--foreground)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
