import { ToastProvider } from '@/components/ui'

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="auth">
        <header className="top">
          <div className="top-in">
            <div className="brand">
              <b>Locação de Brinquedos</b>
              <span>Gestão para locadoras</span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </ToastProvider>
  )
}
