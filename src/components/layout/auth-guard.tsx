"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { Skeleton } from '@/components/ui/skeleton'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/auth/login' 
}: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push(redirectTo)
      } else if (!requireAuth && user) {
        // If user is authenticated and we're on auth pages, redirect to dashboard
        router.push('/')
      }
    }
  }, [user, loading, requireAuth, redirectTo, router])

  // Show loading skeleton while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // If auth is required and user is not authenticated, don't render children
  if (requireAuth && !user) {
    return null
  }

  // If auth is not required and user is authenticated, don't render children (will redirect)
  if (!requireAuth && user) {
    return null
  }

  return <>{children}</>
}
