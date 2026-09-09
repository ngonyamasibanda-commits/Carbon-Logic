import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import IdleWarning from '../auth/IdleWarning'
import InventorySetupNotice from './InventorySetupNotice'

export default function AppShell() {
  return (
    <div className="flex min-h-svh bg-page">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <InventorySetupNotice />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <IdleWarning />
    </div>
  )
}
