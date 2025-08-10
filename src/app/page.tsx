"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { AuthGuard } from "@/components/layout/auth-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, Wallet, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingDown, ArrowDownLeft, ArrowUpRight, Minus } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import Link from "next/link"

interface ExchangeConnection {
  id: string
  exchange: string
  label?: string
  sync_status?: string
  last_synced_at?: string
}

interface Transaction {
  id: string
  txn_type: string
  base_asset: string
  quote_asset?: string
  base_amount: number
  occurred_at: string
}

export default function HomePage() {
  const { user } = useAuth()
  const [exchangeConnections, setExchangeConnections] = useState<ExchangeConnection[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    if (!user) return

    try {
      // Get exchange connections
      const { data: connections } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', user.id)
      
      if (connections) {
        setExchangeConnections(connections)
      }

      // Get recent transactions
      const { data: transactions } = await supabase
        .from('normalized_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false })
        .limit(5)

      if (transactions) {
        setRecentTransactions(transactions)
      }

      // Get total transaction count
      const { count } = await supabase
        .from('normalized_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      
      if (count !== null) {
        setTotalTransactions(count)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user, fetchDashboardData])

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-2xl">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Arklier Finance</h1>
            <p className="text-xl text-muted-foreground">
              Manage your personal finances, track expenses, and plan your financial future
            </p>
          </div>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Connect your crypto exchanges, track transactions, and get insights into your portfolio performance.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">
                Loading your portfolio data...
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  const getConnectionStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getConnectionStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'syncing':
        return 'text-blue-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'deposit':
        return <ArrowDownLeft className="h-4 w-4 text-blue-600" />
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-orange-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const formatAmount = (amount: number | null, asset: string | null) => {
    if (amount === null || asset === null) return '-'
    return `${amount > 0 ? '+' : ''}${amount.toFixed(8)} ${asset}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here&apos;s an overview of your crypto portfolio and exchange connections.
            </p>
          </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                Across all exchanges
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Exchanges</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{exchangeConnections.length}</div>
              <p className="text-xs text-muted-foreground">
                Active connections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {exchangeConnections.length > 0 ? 
                  exchangeConnections.some(c => c.last_synced_at) ? 
                    formatDate(exchangeConnections.find(c => c.last_synced_at)?.last_synced_at || '') : 
                    'Never' : 
                  'N/A'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Most recent sync
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {exchangeConnections.length > 0 ? 
                  exchangeConnections.filter(c => c.sync_status === 'completed').length : 
                  0
                }/{exchangeConnections.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully synced
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest crypto transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No transactions yet</p>
                  <p className="text-sm">Connect an exchange to start tracking</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          {getTransactionIcon(tx.txn_type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {tx.txn_type.replace('_', ' ').toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.base_asset} {tx.quote_asset ? `/ ${tx.quote_asset}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatAmount(tx.base_amount, tx.base_asset)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.occurred_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Link href="/dashboard/transactions">
                      <Button variant="outline" className="w-full">
                        View All Transactions
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Exchange Connections</CardTitle>
              <CardDescription>
                Status of your connected exchanges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {exchangeConnections.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No exchanges connected</p>
                  <Link href="/dashboard/exchanges/firi" className="mt-2 inline-block">
                    <Button size="sm" className="mt-2">
                      Connect Exchange
                    </Button>
                  </Link>
                  <p className="text-xs mt-2">You'll need to sign in to connect exchanges</p>
                </div>
              ) : (
                <>
                  {exchangeConnections.map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getConnectionStatusIcon(connection.sync_status)}
                        <div>
                          <p className="text-sm font-medium">
                            {connection.exchange.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {connection.label || 'Default'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="secondary" 
                          className={getConnectionStatusColor(connection.sync_status)}
                        >
                          {connection.sync_status || 'idle'}
                        </Badge>
                        {connection.last_synced_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(connection.last_synced_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <Link href="/dashboard/exchanges/firi">
                    <Button variant="outline" className="w-full">
                      Manage Connections
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </MainLayout>
    </AuthGuard>
  )
}
