'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Search, Filter, X } from 'lucide-react'
import type { Database } from '@/types/database.types'

type TransactionType = Database['public']['Enums']['txn_type']

interface TransactionFiltersProps {
  onFiltersChange: (filters: TransactionFilters) => void
  availableAssets: string[]
}

export interface TransactionFilters {
  search: string
  transactionType: TransactionType | 'all'
  baseAsset: string | 'all'
  quoteAsset: string | 'all'
  dateFrom: string
  dateTo: string
}

const defaultFilters: TransactionFilters = {
  search: '',
  transactionType: 'all',
  baseAsset: 'all',
  quoteAsset: 'all',
  dateFrom: '',
  dateTo: ''
}

export function TransactionFilters({ onFiltersChange, availableAssets }: TransactionFiltersProps) {
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }

  const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== 'all')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription>
              Filter transactions by type, assets, and date range
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Select
              value={filters.transactionType}
              onValueChange={(value) => handleFilterChange('transactionType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="fee">Fee</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="rebate">Rebate</SelectItem>
                <SelectItem value="trade_match">Trade Match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Base Asset</Label>
            <Select
              value={filters.baseAsset}
              onValueChange={(value) => handleFilterChange('baseAsset', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All assets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assets</SelectItem>
                {availableAssets.map((asset) => (
                  <SelectItem key={asset} value={asset}>
                    {asset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        {isExpanded && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quote Asset</Label>
                <Select
                  value={filters.quoteAsset}
                  onValueChange={(value) => handleFilterChange('quoteAsset', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All assets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assets</SelectItem>
                    {availableAssets.map((asset) => (
                      <SelectItem key={asset} value={asset}>
                        {asset}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
          
          {hasActiveFilters && (
            <div className="text-sm text-muted-foreground">
              {Object.values(filters).filter(v => v !== '' && v !== 'all').length} active filters
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
