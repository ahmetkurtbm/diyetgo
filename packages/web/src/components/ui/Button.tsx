import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-brand-700 text-white shadow-sm shadow-emerald-700/30 hover:bg-brand-800 hover:shadow-md disabled:bg-brand-700/50 disabled:shadow-none',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
} as const

const sizes = {
  // Dokunmatik ekranda dokunma alanı en az 40–44 px olur.
  sm: 'h-8 gap-1.5 px-2.5 text-sm pointer-coarse:h-10 pointer-coarse:px-3',
  md: 'h-10 gap-2 px-4 text-sm pointer-coarse:h-11',
} as const

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({ variant = 'secondary', size = 'md', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium transition duration-150 enabled:active:scale-[0.97] disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}
