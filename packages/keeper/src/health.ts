/**
 * Keeper health monitoring.
 *
 * Tracks sweep results and exposes an HTTP health endpoint at /health.
 * Returns 200 when the keeper is healthy, 503 when unhealthy.
 *
 * Health criteria:
 *   - At least one sweep has completed
 *   - The last sweep was within 3x the configured interval (allows for slow sweeps)
 *   - Fewer than 5 consecutive sweep failures
 */

import { createServer, type Server } from 'node:http'

export interface SweepResult {
  readonly timestamp: number
  readonly renewals: number
  readonly error?: string
}

interface HealthState {
  lastSuccess: SweepResult | null
  lastFailure: SweepResult | null
  consecutiveFailures: number
  totalSweeps: number
  totalRenewals: number
  startedAt: number
}

const MAX_CONSECUTIVE_FAILURES = 5

const state: HealthState = {
  lastSuccess: null,
  lastFailure: null,
  consecutiveFailures: 0,
  totalSweeps: 0,
  totalRenewals: 0,
  startedAt: Date.now(),
}

/** Record a successful sweep. */
export function recordSuccess(renewals: number): void {
  state.lastSuccess = { timestamp: Date.now(), renewals }
  state.consecutiveFailures = 0
  state.totalSweeps++
  state.totalRenewals += renewals
}

/** Record a failed sweep. */
export function recordFailure(error: string): void {
  state.lastFailure = { timestamp: Date.now(), renewals: 0, error }
  state.consecutiveFailures++
  state.totalSweeps++
}

/** Check if the keeper is healthy given the configured interval. */
function isHealthy(intervalMs: number): boolean {
  // Allow 3x interval for slow sweeps + processing time
  const maxStaleness = intervalMs * 3

  // Unhealthy if too many consecutive failures
  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return false

  // Healthy if we haven't had a chance to sweep yet (just started)
  if (state.totalSweeps === 0) return true

  // Unhealthy if last success is too stale
  if (state.lastSuccess) {
    const age = Date.now() - state.lastSuccess.timestamp
    if (age > maxStaleness) return false
  }

  return true
}

/**
 * Start an HTTP health check server on the given port.
 * Returns the server instance for graceful shutdown.
 */
export function startHealthServer(port: number, intervalMs: number): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const healthy = isHealthy(intervalMs)
      const body = JSON.stringify({
        status: healthy ? 'healthy' : 'unhealthy',
        uptime: Math.floor((Date.now() - state.startedAt) / 1000),
        totalSweeps: state.totalSweeps,
        totalRenewals: state.totalRenewals,
        consecutiveFailures: state.consecutiveFailures,
        lastSuccess: state.lastSuccess
          ? new Date(state.lastSuccess.timestamp).toISOString()
          : null,
        lastFailure: state.lastFailure
          ? {
              at: new Date(state.lastFailure.timestamp).toISOString(),
              error: state.lastFailure.error,
            }
          : null,
      })

      res.writeHead(healthy ? 200 : 503, {
        'Content-Type': 'application/json',
      })
      res.end(body)
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[keeper] Health endpoint listening on port ${port}`)
  })

  return server
}
