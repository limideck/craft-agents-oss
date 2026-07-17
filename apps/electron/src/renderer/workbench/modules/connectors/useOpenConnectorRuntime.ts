import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OpenConnectorSidecarConfig, OpenConnectorSidecarStatus } from '../../../../shared/open-connector'
import {
  createOpenConnectorClient,
  loadOpenConnectorData,
  type OpenConnectorConfig,
} from './api'
import { emptyData, type AppData } from './model'

export interface OpenConnectorRuntime {
  status: OpenConnectorSidecarStatus | null
  config: OpenConnectorConfig | null
  data: AppData
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  restart: () => Promise<void>
}

const offlineStatus: OpenConnectorSidecarStatus = {
  ready: false,
  starting: false,
  external: false,
  baseUrl: null,
  adminToken: null,
  runtimeToken: null,
  port: null,
  error: null,
  pid: null,
}

export function useOpenConnectorRuntime(enabled: boolean): OpenConnectorRuntime {
  const [status, setStatus] = useState<OpenConnectorSidecarStatus | null>(null)
  const [config, setConfig] = useState<OpenConnectorConfig | null>(null)
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshToken = useRef(0)

  const load = useCallback(async () => {
    if (!enabled) return
    const requestId = ++refreshToken.current
    setLoading(true)
    setError(null)

    try {
      const api = window.electronAPI
      if (!api?.getOpenConnectorStatus || !api?.getOpenConnectorConfig) {
        setStatus(offlineStatus)
        setConfig(null)
        setData(emptyData)
        setError('OpenConnector IPC is not available yet')
        return
      }

      let nextStatus: OpenConnectorSidecarStatus
      try {
        nextStatus = await api.getOpenConnectorStatus()
      } catch {
        nextStatus = offlineStatus
      }
      if (requestId !== refreshToken.current) return
      setStatus(nextStatus)

      let nextConfig: OpenConnectorSidecarConfig | null = null
      try {
        nextConfig = await api.getOpenConnectorConfig()
      } catch (err) {
        if (requestId !== refreshToken.current) return
        setError(err instanceof Error ? err.message : 'Failed to start OpenConnector runtime')
        setConfig(null)
        setData(emptyData)
        return
      }
      if (requestId !== refreshToken.current) return

      if (!nextConfig?.ready || !nextConfig.baseUrl || !nextConfig.adminToken) {
        setConfig(nextConfig)
        setData(emptyData)
        return
      }

      const clientConfig: OpenConnectorConfig = {
        baseUrl: nextConfig.baseUrl,
        adminToken: nextConfig.adminToken,
        runtimeToken: nextConfig.runtimeToken,
      }
      setConfig(clientConfig)

      const client = createOpenConnectorClient(clientConfig)
      const nextData = await loadOpenConnectorData(client, clientConfig.adminToken)
      if (requestId !== refreshToken.current) return
      setData(nextData)
    } catch (err) {
      if (requestId !== refreshToken.current) return
      setError(err instanceof Error ? err.message : 'Failed to load OpenConnector data')
      setData(emptyData)
    } finally {
      if (requestId === refreshToken.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  // Poll status while starting
  useEffect(() => {
    if (!enabled || !status?.starting || status.ready) return
    const timer = setInterval(() => {
      void load()
    }, 1500)
    return () => clearInterval(timer)
  }, [enabled, status?.starting, status?.ready, load])

  const restart = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.restartOpenConnector) {
      setError('OpenConnector restart is not available yet')
      return
    }
    setLoading(true)
    try {
      await api.restartOpenConnector()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart OpenConnector')
    } finally {
      setLoading(false)
    }
  }, [load])

  return useMemo(
    () => ({
      status,
      config,
      data,
      loading,
      error,
      refresh: load,
      restart,
    }),
    [status, config, data, loading, error, load, restart],
  )
}
