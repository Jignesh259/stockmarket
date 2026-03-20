import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import Watchlist from '../components/Watchlist.jsx'
import ChartPanel from '../components/ChartPanel.jsx'
import PredictionPanel from '../components/PredictionPanel.jsx'
import { getMarketStatus, getStockList, getLiveCandles, getPrediction, getPredictionHistory } from '../api/stockApi.js'
import '../styles/dashboard.css'
import '../styles/chart.css'
import '../styles/watchlist.css'

export default function Dashboard() {
  const [marketStatus, setMarketStatus] = useState(null)
  const [marketClosed, setMarketClosed] = useState(false)
  const [watchlist, setWatchlist] = useState([])
  const [filtered, setFiltered] = useState([])
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [candles, setCandles] = useState([])
  const [predictionsOnChart, setPredictionsOnChart] = useState([])
  const [predictionInsight, setPredictionInsight] = useState(null)
  const [predictionHistory, setPredictionHistory] = useState([])
  const [selectedMarket, setSelectedMarket] = useState('NSE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Check if market is closed (3:30 PM or later)
  useEffect(() => {
    const checkMarketClose = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      
      // Market closes at 3:30 PM (15:30)
      const isClosed = hours >= 15 && minutes >= 30
      
      setMarketClosed(isClosed)
    }

    checkMarketClose()
    const interval = setInterval(checkMarketClose, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    getMarketStatus()
      .then(setMarketStatus)
      .catch(() => setError('⚠️ Cannot reach backend server. Make sure it is running on port 8000: cd backend && uvicorn app.main:app --reload --port 8000'))
    getStockList()
      .then((data) => {
        setWatchlist(data || [])
        setFiltered(data || [])
        if (data && data.length) {
          setSelectedSymbol(data[0].symbol)
        }
      })
      .catch(() => {}) // error already shown by market status fetch
  }, [])

  useEffect(() => {
    if (!selectedSymbol) return
    
    const controller = new AbortController()
    const { signal } = controller

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch candles and history together; prediction is optional — 404 means "not ready yet"
        const [candleData, history, prediction] = await Promise.all([
          getLiveCandles(selectedSymbol, signal),
          getPredictionHistory(selectedSymbol, signal),
          getPrediction(selectedSymbol, signal).catch(() => null),  // gracefully handle 404
        ])
        setCandles(candleData || [])
        setPredictionInsight(prediction || null)
        setPredictionHistory(history || [])

        const mappedPredictions = (history || [])
          .filter((h) => h.prediction_time_epoch)
          .map((h) => ({
            time: h.prediction_time_epoch,
            direction: h.direction,
            confidence: h.confidence,
            correct: h.correct,
          }))
        setPredictionsOnChart(mappedPredictions)
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error(e)
          setError(e.message || 'Failed to fetch data')
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()
    
    // Refresh every 15 minutes (15m prediction interval)
    const refreshInterval = 15 * 60 * 1000 // 15 minutes
    const id = setInterval(load, refreshInterval)
    return () => {
      clearInterval(id)
      controller.abort()
    }
  }, [selectedSymbol])

  const handleSearchSymbol = (symbol) => {
    const found = watchlist.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase())
    if (found) {
      setSelectedSymbol(found.symbol)
    }
  }

  const handleFilter = (term) => {
    const lower = term.toLowerCase()
    if (!lower) {
      setFiltered(watchlist)
      return
    }
    setFiltered(
      watchlist.filter(
        (s) =>
          s.symbol.toLowerCase().includes(lower) ||
          (s.name && s.name.toLowerCase().includes(lower)),
      ),
    )
  }

  const handleRefresh = () => {
    if (!selectedSymbol) return
    setError(null)
    getMarketStatus().then(setMarketStatus).catch((e) => setError(e.message || 'Failed to refresh market status'))
    getLiveCandles(selectedSymbol).then(setCandles).catch((e) => setError(e.message || 'Failed to refresh candles'))
    getPrediction(selectedSymbol).then(setPredictionInsight).catch(() => setPredictionInsight(null))  // 404 = not ready
    getPredictionHistory(selectedSymbol).then(setPredictionHistory).catch((e) => setError(e.message || 'Failed to refresh history'))
  }

  return (
    <div className="dash-root">
      <Navbar
        marketStatus={marketStatus}
        onSearch={handleSearchSymbol}
        onRefresh={handleRefresh}
        selectedMarket={selectedMarket}
        onChangeMarket={setSelectedMarket}
        symbols={watchlist}
      />

      {(marketClosed || !marketStatus?.is_open) && (
        <div className="dash-market-banner">
          {marketClosed ? '🔴 Market Closed - Trading Hours Ended (3:30 PM)' : 'Indian stock market is currently closed.'}
        </div>
      )}

      {error && (
        <div className="dash-market-banner" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444' }}>
          ❌ Error: {error}
        </div>
      )}

      <main className="dash-main" aria-label="Dashboard Content">
        <Watchlist
          stocks={filtered}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          onSearchTerm={handleFilter}
          aria-label="Stock Watchlist"
        />
        <ChartPanel 
          symbol={selectedSymbol} 
          candles={candles} 
          predictions={predictionsOnChart}
          marketClosed={marketClosed}
          aria-label="Price Chart"
        />
        <PredictionPanel
          symbol={selectedSymbol}
          insight={predictionInsight}
          history={predictionHistory}
          aria-label="Prediction Insights"
        />
      </main>
    </div>
  )
}

