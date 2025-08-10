'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConnectionStatus } from '@/components/blocks/connection-status'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type ExchangeConnection = Database['public']['Tables']['exchange_connections']['Row']

export default function FiriConnect() {
  const [apiKey, setApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [connection, setConnection] = useState<ExchangeConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [showConnectionForm, setShowConnectionForm] = useState(false)

  useEffect(() => {
    loadConnection()
  }, [])

  async function loadConnection() {
    console.log('🔄 Loading connection...')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    console.log('🔍 Querying database for connection...')
    const { data, error } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange', 'firi')
      .single()

    console.log('📋 Database query result:', { data, error })

    if (data) {
      console.log('✅ Connection found:', data)
      setConnection(data)
      setIsConnected(true)
      setApiKey(data.api_key)
      setClientId(data.client_id)
      // Don't hide the form - keep it visible to show connection status
      // setShowConnectionForm(false)
    } else {
      console.log('❌ No connection found')
      setConnection(null)
      setIsConnected(false)
      setApiKey('')
      setClientId('')
      setSecret('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await save()
  }

  async function save() {
    setLoading(true)
    setMsg(null)
    
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMsg('Error: Not authenticated. Please log in again.')
        return
      }

      const r = await fetch('/api/exchanges/firi/connect', {
        method: 'POST',
        headers: { 
          'content-type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ apiKey, clientId, secret })
      })
      const j = await r.json()
      
      if (r.ok) {
        setMsg('Connected successfully!')
        setIsConnected(true)
        setShowConnectionForm(false)
        await loadConnection()
      } else {
        setMsg(`Error: ${j.error || 'failed'}`)
      }
    } catch (error) {
      setMsg(`Error: ${error instanceof Error ? error.message : 'failed'}`)
    } finally {
      setLoading(false)
    }
  }

  async function syncNow() {
    setLoading(true)
    setMsg(null)
    
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMsg('Error: Not authenticated. Please log in again.')
        return
      }

      if (!connection) {
        setMsg('Error: No connection found. Please connect first.')
        return
      }

      const r = await fetch('/api/exchanges/firi/sync', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ connectionId: connection.id })
      })
      const j = await r.json()
      
      if (r.ok) {
        setMsg('Sync started successfully!')
        await loadConnection()
      } else {
        setMsg(`Error: ${j.error || 'failed'}`)
      }
    } catch (error) {
      setMsg(`Error: ${error instanceof Error ? error.message : 'failed' }`)
    } finally {
      setLoading(false)
    }
  }

  // Show the connection form if requested
  if (showConnectionForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Firi Exchange</h1>
          {isConnected && (
            <Button variant="outline" onClick={syncNow} disabled={loading}>
              {loading ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection Form */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Settings</CardTitle>
              <CardDescription>
                Enter your Firi API credentials to connect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input 
                    id="apiKey"
                    value={apiKey} 
                    onChange={e => setApiKey(e.target.value)} 
                    placeholder="API key"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input 
                    id="clientId"
                    value={clientId} 
                    onChange={e => setClientId(e.target.value)} 
                    placeholder="Client ID"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">Secret</Label>
                  <Input 
                    id="secret"
                    type="password" 
                    value={secret} 
                    onChange={e => setSecret(e.target.value)} 
                    placeholder="Secret key"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {isConnected ? 'Update Connection' : 'Connect'}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowConnectionForm(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
              {msg && (
                <div className={`mt-4 text-sm p-3 rounded-md ${
                  msg.includes('Error') 
                    ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                    : 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800'
                }`}>
                  {msg}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connection Status */}
          {connection && (
            <ConnectionStatus 
              connection={connection} 
              onSync={loadConnection}
            />
          )}
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to get your Firi API credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Log in to your Firi account</p>
            <p>2. Go to Settings → API Keys</p>
            <p>3. Create a new API key with the following permissions:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Read access to account information</li>
              <li>Read access to transaction history</li>
              <li>Read access to order history</li>
            </ul>
            <p>4. Copy the API Key, Client ID, and Secret to the form above</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // If no connection and form is not shown, display the main connect button
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Exchange Connections</h1>
        {isConnected && (
          <Button variant="outline" onClick={syncNow} disabled={loading}>
            {loading ? 'Syncing...' : 'Sync Now'}
          </Button>
        )}
      </div>
      
      {isConnected && connection ? (
        // Show connection status when connected
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Details</CardTitle>
              <CardDescription>
                Your Firi exchange connection is active
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Key:</span>
                <span className="text-sm text-muted-foreground font-mono">
                  {apiKey.substring(0, 8)}...
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Client ID:</span>
                <span className="text-sm text-muted-foreground font-mono">
                  {clientId}
                </span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowConnectionForm(true)}
                className="w-full"
              >
                Edit Connection
              </Button>
            </CardContent>
          </Card>

          <ConnectionStatus 
            connection={connection} 
            onSync={loadConnection}
          />
        </div>
      ) : (
        // Show connect button when not connected
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Exchange Connections</CardTitle>
            <CardDescription>Status of your connected exchanges</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">No exchanges connected</p>
            <Button 
              onClick={() => setShowConnectionForm(true)} 
              className="w-full"
              size="lg"
              type="button"
            >
              Connect Exchange
            </Button>
            <p className="text-xs text-muted-foreground">
              Click the button above to enter your Firi API credentials
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
