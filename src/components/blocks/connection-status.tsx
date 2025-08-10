'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Clock, AlertCircle, CheckCircle, RefreshCw, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type ExchangeConnection = Database['public']['Tables']['exchange_connections']['Row']

interface ConnectionStatusProps {
  connection: ExchangeConnection
  onSync?: () => void
}

export function ConnectionStatus({ connection, onSync }: ConnectionStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(connection.last_synced_at)
  const [syncStatus, setSyncStatus] = useState<string | null>(connection.sync_status)
  const [syncError, setSyncError] = useState<string | null>(connection.sync_error)

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'syncing':
        return 'info'
      case 'error':
        return 'error'
      default:
        return 'secondary'
    }
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'error':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
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

  const handleSync = async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncStatus('syncing')
    setSyncError(null)

    try {
      const response = await fetch('/api/exchanges/firi/sync', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ connectionId: connection.id })
      })
      const result = await response.json()

      if (response.ok) {
        setSyncStatus('completed')
        setLastSyncTime(new Date().toISOString())
        setSyncError(null)
        onSync?.()
      } else {
        setSyncStatus('error')
        setSyncError(result.error || 'Sync failed')
      }
    } catch (error) {
      setSyncStatus('error')
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon(syncStatus)}
          Connection Status
        </CardTitle>
        <CardDescription>
          {connection.exchange.toUpperCase()} - {connection.label || 'Default'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={getStatusVariant(syncStatus) as any}>
            {syncStatus || 'idle'}
          </Badge>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Last Sync:</span>
          <span className="text-sm text-muted-foreground">
            {formatLastSync(lastSyncTime)}
          </span>
        </div>

        {syncError && (
          <>
            <Separator />
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Sync Error</p>
                <p className="text-destructive/80 mt-1">{syncError}</p>
              </div>
            </div>
          </>
        )}

        <Button 
          onClick={handleSync} 
          disabled={isSyncing}
          className="w-full"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </>
          )}
        </Button>

        <Button 
          variant="outline"
          onClick={() => onSync?.()}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </CardContent>
    </Card>
  )
}
