import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Figtree } from 'next/font/google'
import { RegistraSW } from '@/components/RegistraSW'
import './globals.css'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-display' })
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' })

export const metadata: Metadata = {
  title: { default: 'Gestão de Locação de Brinquedos', template: '%s · Locação de Brinquedos' },
  description: 'Agenda, locações, clientes, brinquedos e caixa da sua locadora.',
  applicationName: 'Locação de Brinquedos',
  appleWebApp: { capable: true, title: 'Locações', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFC72C',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <RegistraSW />
      </body>
    </html>
  )
}
