const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function Icone({ nome }: { nome: 'inicio' | 'agenda' | 'locacoes' | 'cadastros' | 'caixa' | 'ajustes' }) {
  switch (nome) {
    case 'inicio':
      return (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>)
    case 'agenda':
      return (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>)
    case 'locacoes':
      return (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" /><path d="M14 5v14" strokeDasharray="2 2.5" /></svg>)
    case 'cadastros':
      return (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></svg>)
    case 'caixa':
      return (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z" /><path d="M4 7V6a2 2 0 0 1 2-2h10v3" /><circle cx="16" cy="13.5" r="1.3" /></svg>)
    case 'ajustes':
      return (<svg viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>)
  }
}
