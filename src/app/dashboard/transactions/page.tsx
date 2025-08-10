'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { TransactionFilters, type TransactionFilters as TransactionFiltersType } from '@/components/blocks/transaction-filters'
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Minus, Plus } from 'lucide-react'
import type { Database } from '@/types/database.types'

type NormalizedTransaction = Database['public']['Tables']['normalized_transactions']['Row']
type TransactionType = Database['public']['Enums']['txn_type']

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<NormalizedTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [availableAssets, setAvailableAssets] = useState<string[]>([])
  const [filters, setFilters] = useState<TransactionFiltersType>({
    search: '',
    transactionType: 'all',
    baseAsset: 'all',
    quoteAsset: 'all',
    dateFrom: '',
    dateTo: ''
  })

  const applyFilters = useCallback(() => {
    let filtered = [...transactions]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(tx => 
        tx.base_asset?.toLowerCase().includes(searchLower) ||
        tx.quote_asset?.toLowerCase().includes(searchLower) ||
        tx.txn_type.toLowerCase().includes(searchLower) ||
        tx.order_id?.toLowerCase().includes(searchLower)
      )
    }

    // Transaction type filter
    if (filters.transactionType !== 'all') {
      filtered = filtered.filter(tx => tx.txn_type === filters.transactionType)
    }

    // Base asset filter
    if (filters.baseAsset !== 'all') {
      filtered = filtered.filter(tx => tx.base_asset === filters.baseAsset)
    }

    // Quote asset filter
    if (filters.quoteAsset !== 'all') {
      filtered = filtered.filter(tx => tx.quote_asset === filters.quoteAsset)
    }

    // Date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter(tx => new Date(tx.occurred_at) >= new Date(filters.dateFrom))
    }
    if (filters.dateTo) {
      filtered = filtered.filter(tx => new Date(tx.occurred_at) <= new Date(filters.dateTo))
    }

    setFilteredTransactions(filtered)
  }, [transactions, filters]);

  useEffect(() => {
    loadTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, filters, applyFilters])

  async function loadTransactions() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('normalized_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false })
        .limit(500)

      if (data) {
        setTransactions(data)
        
        // Extract unique assets for filters
        const assets = new Set<string>()
        data.forEach((tx: NormalizedTransaction) => {
          if (tx.base_asset) assets.add(tx.base_asset)
          if (tx.quote_asset) assets.add(tx.quote_asset)
          if (tx.fee_asset) assets.add(tx.fee_asset)
        })
        setAvailableAssets(Array.from(assets).sort())
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltersChange(newFilters: TransactionFiltersType) {
    setFilters(newFilters)
  }

  function getTransactionIcon(type: TransactionType) {
    switch (type) {
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'deposit':
        return <ArrowDownLeft className="h-4 w-4 text-blue-600" />
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-orange-600" />
      case 'fee':
        return <Minus className="h-4 w-4 text-red-500" />
      case 'bonus':
      case 'rebate':
        return <Plus className="h-4 w-4 text-green-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  function getTransactionColor(type: TransactionType) {
    switch (type) {
      case 'buy':
        return 'text-green-600'
      case 'sell':
        return 'text-red-600'
      case 'deposit':
        return 'text-blue-600'
      case 'withdrawal':
        return 'text-orange-600'
      case 'fee':
        return 'text-red-500'
      case 'bonus':
      case 'rebate':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }



  function formatPrice(price: number | null) {
    if (price === null) return '-'
    return `$${price.toFixed(2)}`
  }

  function formatDate(dateString: string) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            View and filter your transaction history across all exchanges
          </p>
        </div>
        <Button onClick={loadTransactions} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <TransactionFilters 
        onFiltersChange={handleFiltersChange}
        availableAssets={availableAssets}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            <p className="text-xs text-muted-foreground">Total Transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {filteredTransactions.filter(tx => tx.txn_type === 'buy').length}
            </div>
            <p className="text-xs text-muted-foreground">Buy Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {filteredTransactions.filter(tx => tx.txn_type === 'sell').length}
            </div>
            <p className="text-xs text-muted-foreground">Sell Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {filteredTransactions.filter(tx => tx.txn_type === 'deposit').length}
            </div>
            <p className="text-xs text-muted-foreground">Deposits</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {filteredTransactions.length} of {transactions.length} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Base Asset</th>
                    <th className="text-left p-3 font-medium">Base Amount</th>
                    <th className="text-left p-3 font-medium">Quote Asset</th>
                    <th className="text-left p-3 font-medium">Quote Amount</th>
                    <th className="text-left p-3 font-medium">Price</th>
                    <th className="text-left p-3 font-medium">Fee</th>
                    <th className="text-left p-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx.txn_type)}
                          <Badge variant="secondary" className={getTransactionColor(tx.txn_type)}>
                            {tx.txn_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 font-medium">{tx.base_asset || '-'}</td>
                      <td className="p-3 font-mono">
                        {tx.base_amount ? (tx.base_amount > 0 ? '+' : '') + tx.base_amount.toFixed(8) : '-'}
                      </td>
                      <td className="p-3 font-medium">{tx.quote_asset || '-'}</td>
                      <td className="p-3 font-mono">
                        {tx.quote_amount ? (tx.quote_amount > 0 ? '+' : '') + tx.quote_amount.toFixed(8) : '-'}
                      </td>
                      <td className="p-3 font-mono">{formatPrice(tx.price)}</td>
                      <td className="p-3 font-mono">
                        {tx.fee_amount ? `${tx.fee_amount.toFixed(8)} ${tx.fee_asset}` : '-'}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-medium">{formatDate(tx.occurred_at)}</span>
                          <span className="text-xs">
                            {new Date(tx.occurred_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
