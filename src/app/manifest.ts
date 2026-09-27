import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gestão de Locação de Brinquedos',
    short_name: 'Locações',
    description: 'Agenda, locações, clientes, brinquedos e caixa da sua locadora.',
    lang: 'pt-BR',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EEF1F6',
    theme_color: '#FFC72C',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
