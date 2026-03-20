const BASE_URL = import.meta.env.VITE_API_URL;
// ❗ IMPORTANT: Keep BASE_URL empty for local development. 
// This allows the Vite proxy (see vite.config.js) to handle the requests, avoiding CORS errors.
// If you hardcode 'http://127.0.0.1:19099' here, it bypasses the proxy and causes CORS blocks.

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text()
    let message
    try {
      const json = JSON.parse(text)
      message = json?.detail || json?.message || text
    } catch {
      message = text || `Request failed with status ${res.status}`
    }
    throw new Error(message)
  }
  return res.json()
}

export async function getMarketStatus() {
  const res = await fetch(`${BASE_URL}/api/stocks/market/status`)
  return handleResponse(res)
}

export async function getStockList() {
  const res = await fetch(`${BASE_URL}/api/stocks/list`)
  return handleResponse(res)
}

export async function getLiveCandles(symbol, signal = null) {
  const url = new URL(`${BASE_URL}/api/stocks/live`, window.location.origin)
  url.searchParams.set('symbol', symbol)
  const res = await fetch(url, { signal })
  return handleResponse(res)
}

export async function getPrediction(symbol, signal = null) {
  const url = new URL(`${BASE_URL}/api/stocks/predict`, window.location.origin)
  url.searchParams.set('symbol', symbol)
  const res = await fetch(url, { signal })
  return handleResponse(res)
}

export async function getPredictionHistory(symbol, signal = null) {
  const url = new URL(`${BASE_URL}/api/stocks/history`, window.location.origin)
  url.searchParams.set('symbol', symbol)
  const res = await fetch(url, { signal })
  return handleResponse(res)
}

