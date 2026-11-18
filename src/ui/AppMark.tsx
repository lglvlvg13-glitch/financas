import { useId } from 'react'

/** Símbolo do app (casa com barras subindo), o mesmo do ícone do celular. */
export function AppMark({ size = 30, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <radialGradient id={`bg${id}`} cx="30%" cy="15%" r="95%"><stop offset="0" stopColor="#4b6122" /><stop offset=".55" stopColor="#26330f" /><stop offset="1" stopColor="#121a08" /></radialGradient>
        <linearGradient id={`bar${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfe596" /><stop offset="1" stopColor="#7f9e3c" /></linearGradient>
        <linearGradient id={`gold${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1d58e" /><stop offset="1" stopColor="#a8822e" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill={`url(#bg${id})`} />
      <path d="M120 244 L256 132 L392 244" fill="none" stroke="#cfe596" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="164" y="310" width="44" height="70" rx="12" fill={`url(#bar${id})`} />
      <rect x="234" y="276" width="44" height="104" rx="12" fill={`url(#bar${id})`} />
      <rect x="304" y="240" width="44" height="140" rx="12" fill={`url(#gold${id})`} />
    </svg>
  )
}
