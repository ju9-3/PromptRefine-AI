import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout({ children }) {
  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  )
}
