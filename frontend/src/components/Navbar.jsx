import { useEffect, useMemo, useState, useRef } from 'react'

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="nav-time-value">{formatTime(now)}</span>
}

const MARKET_NAMES = ['NSE', 'BSE']

export default function Navbar({
  marketStatus,
  onSearch,
  onRefresh,
  selectedMarket,
  onChangeMarket,
  symbols = [],
}) {
  const [now, setNow] = useState(new Date())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [marketClosed, setMarketClosed] = useState(false)
  
  const searchContainerRef = useRef(null)

  // Check if market is closed (3:30 PM or later)
  useEffect(() => {
    const checkMarketClose = () => {
      const currentTime = new Date()
      const hours = currentTime.getHours()
      const minutes = currentTime.getMinutes()
      
      // Market closes at 3:30 PM (15:30). Open only Monday-Friday.
      const isWeekday = currentTime.getDay() >= 1 && currentTime.getDay() <= 5
      const isClosed = !isWeekday || (hours > 15 || (hours === 15 && minutes >= 30)) || hours < 9
      
      setMarketClosed(isClosed)
    }

    checkMarketClose()
    const interval = setInterval(checkMarketClose, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (search.trim()) {
      onSearch?.(search.trim().toUpperCase())
      setShowSuggestions(false)
    }
  }

  const isMarketClosed = marketClosed || !marketStatus?.is_open
  const statusClass = isMarketClosed ? 'nav-status-closed' : 'nav-status-open'
  const statusText = marketClosed ? '🔴 Market Closed (3:30 PM)' : (marketStatus?.is_open ? '🟢 Market Open' : '🔴 Market Closed')

  const suggestions = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return []
    return symbols
      .filter(
        (s) =>
          s.symbol.toLowerCase().includes(term) ||
          (s.name && s.name.toLowerCase().includes(term)),
      )
      .slice(0, 8)
  }, [symbols, debouncedSearch])

  return (
    <header className="nav-root">
      <div className="nav-left">
        <div className="nav-market">
          <span className="nav-market-label">Market</span>
          <select
            className="nav-market-select"
            value={selectedMarket}
            onChange={(e) => onChangeMarket?.(e.target.value)}
            disabled={isMarketClosed}
            aria-label="Select Market"
          >
            {MARKET_NAMES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="nav-time">
          <span className="nav-time-label">IST</span>
          <Clock />
        </div>
        <div className={`nav-status ${statusClass}`}>
          <span className="nav-status-dot" />
          <span>{statusText}</span>
        </div>
      </div>

      <div className="nav-search-wrapper" ref={searchContainerRef}>
        <form className="nav-search" onSubmit={handleSubmit}>
          <input
            className="nav-search-input"
            type="text"
            placeholder="Search symbol (e.g. RELIANCE, TCS)..."
            aria-label="Search stock symbols"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          <button type="submit" className="nav-search-btn">
            Search
          </button>
        </form>
        {showSuggestions && suggestions.length > 0 && (
          <div className="nav-suggest-list">
            {suggestions.map((s) => (
              <button
                key={s.symbol}
                type="button"
                className="nav-suggest-item"
                onClick={() => {
                  onSearch?.(s.symbol)
                  setSearch(s.symbol)
                  setShowSuggestions(false)
                }}
              >
                <span className="nav-suggest-symbol">{s.symbol}</span>
                <span className="nav-suggest-name">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="nav-actions">
        <button 
          type="button" 
          className="nav-btn nav-btn-secondary" 
          onClick={onRefresh}
          disabled={isMarketClosed}
          title={isMarketClosed ? 'Market is closed' : 'Refresh data'}
        >
          Refresh
        </button>
        <button 
          type="button" 
          className="nav-btn nav-btn-primary"
          disabled={isMarketClosed}
          title={isMarketClosed ? 'Market is closed' : 'Publish idea'}
        >
          Publish Idea
        </button>
      </div>
    </header>
  )
}

