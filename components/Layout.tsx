import ClientWrapper from './ClientWrapper'
import Header from './Header'
import Navigation from './Navigation'
import PermissionError from './PermissionError'
import NotificationScheduler from './NotificationScheduler'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <ClientWrapper>
        <NotificationScheduler />
        <Header className="sticky top-0 z-50" />
        <div className="flex flex-1 overflow-hidden">
          <Navigation viewPort='main' />
          <div className="flex-1 flex flex-col">
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background relative">
              {/* responsive container */}
              <div className="mx-auto px-4 py-8 max-w-5xl">
                <PermissionError />
                {children}
              </div>
            </main>
            <Navigation viewPort='mobile' />
          </div>
        </div>
      </ClientWrapper>
    </div>
  )
}

