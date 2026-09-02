import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { BarChart3, Truck, PieChart } from 'lucide-react'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Carbon Logic',
  description: 'Professional Emissions Calculator',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-card border-r border-border flex flex-col">
            <div className="p-6 border-b border-border">
              <h1 className="text-xl font-bold text-foreground">Carbon Logic</h1>
              <p className="text-xs text-muted-foreground mt-1">Professional Emissions Calculator</p>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              <Link 
                href="/" 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <BarChart3 size={18} />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <Link 
                href="/emissions" 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Truck size={18} />
                <span className="text-sm font-medium">Emissions</span>
              </Link>
              <Link 
                href="/executive" 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <PieChart size={18} />
                <span className="text-sm font-medium">Executive</span>
              </Link>
            </nav>
            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted-foreground">© Carbon Logic</p>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 bg-background overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
