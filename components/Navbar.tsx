'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Consulta' },
  { href: '/registro', label: 'Afiliación' },
  { href: '/desafiliacion', label: 'Desafiliación' },
  { href: '/admin', label: 'Administración' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="apd-strip" />
      <nav className="bg-[#0D3B8C] sticky top-0 z-50 shadow-md">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <Image src="/logo-apd.png" alt="APD" width={85} height={85} className="object-contain drop-shadow-md" />
            <div className="leading-tight">
              <p className="text-white font-semibold text-sm">APD · Afiliaciones</p>
              <p className="text-white/60 text-[11px] hidden sm:block">Alianza por la Democracia</p>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  pathname === href ? 'bg-white/20 text-white font-medium' : 'text-white/75 hover:bg-white/15 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <button className="sm:hidden text-white p-2 rounded-lg hover:bg-white/15" onClick={() => setOpen(!open)} aria-label="Menú">
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
        {open && (
          <div className="sm:hidden bg-[#0a3070] border-t border-white/10 px-4 py-3 space-y-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center h-11 px-4 rounded-xl text-sm font-medium transition-colors ${
                  pathname === href ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </>
  )
}
