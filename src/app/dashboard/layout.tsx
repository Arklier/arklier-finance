import { AuthGuard } from '@/components/layout/auth-guard'
import { MainLayout } from '@/components/layout/main-layout'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requireAuth={true} redirectTo="/auth/login">
      <MainLayout>
        {children}
      </MainLayout>
    </AuthGuard>
  )
}
