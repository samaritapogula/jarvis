/**
 * Network checks for the local ChatGPT Plus bridge.
 *
 * Only loopback Host headers and trusted local Vite origins are accepted.
 * The bridge is never intended to be exposed to a LAN or the public internet.
 */
const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function localHost(header) {
  if (typeof header !== 'string' || !header) return false
  try {
    const url = new URL('http://' + header)
    return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash &&
      LOCAL_NAMES.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function localOrigin(origin, extraOrigins = '') {
  if (typeof origin !== 'string' || !origin) return false
  let url
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' || !LOCAL_NAMES.has(url.hostname.toLowerCase())) return false
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return false
  const port = Number(url.port)
  if ((port >= 5173 && port <= 5199) || (port >= 4173 && port <= 4199)) return true
  // The stock launcher sets this for PORT=<nonstandard local dev port>.
  return extraOrigins.split(',').some((entry) => {
    try {
      const trusted = new URL(entry.trim())
      return trusted.origin === url.origin && trusted.protocol === 'http:' &&
        LOCAL_NAMES.has(trusted.hostname.toLowerCase())
    } catch {
      return false
    }
  })
}
