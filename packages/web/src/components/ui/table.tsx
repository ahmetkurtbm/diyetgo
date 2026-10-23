import type { TdHTMLAttributes, ThHTMLAttributes, ReactNode } from 'react'

export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="min-w-full divide-y divide-slate-200 text-sm">
        {children}
      </table>
    </div>
  )
}

export function Th({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={`bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase ${className}`} {...props} />
}

export function Td({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-middle text-slate-700 ${className}`} {...props} />
}
