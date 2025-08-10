"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/components/providers/auth-provider"
import { 
  Home, 
  Wallet, 
  CreditCard, 
  Menu,
  LogOut,
  User
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const sidebarItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/dashboard/transactions", label: "Transactions", icon: CreditCard },
  { href: "/dashboard/exchanges/firi", label: "Exchanges", icon: Wallet },
]

export function Sidebar() {
  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="outline" size="icon" className="lg:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        <SidebarContent />
      </div>
    </>
  )
}

function SidebarContent() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-semibold text-sidebar-foreground">
          Arklier Finance
        </h1>
      </div>
      
      <nav className="flex-1 space-y-1 p-4">
        {sidebarItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="flex items-center space-x-3 px-3 py-2 text-sm text-sidebar-foreground">
            <User className="h-4 w-4" />
            <span className="truncate">{user.email}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <ThemeToggle />
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
