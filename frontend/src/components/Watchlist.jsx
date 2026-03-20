import { useMemo } from 'react'

export default function Watchlist({ stocks, selectedSymbol, onSelectSymbol, onSearchTerm }) {
  const grouped = useMemo(() => {
    const result = { NIFTY50: [], SENSEX: [] }
    stocks.forEach((s) => {
      if (s.index === 'NIFTY50') {
        result.NIFTY50.push(s)
      } else if (s.index === 'SENSEX') {
        result.SENSEX.push(s)
      }
    })
    return result
  }, [stocks])

  return (
    <aside className="watchlist-root">
      <div className="watchlist-header">
        <h2>Watchlist</h2>
        <input
          type="text"
          className="watchlist-search"
          placeholder="Filter stocks..."
          onChange={(e) => onSearchTerm?.(e.target.value)}
        />
      </div>

      <div className="watchlist-section">
        <div className="watchlist-section-title">NIFTY 50</div>
        <div className="watchlist-list">
          {grouped.NIFTY50.length > 0 ? (
            grouped.NIFTY50.map((s) => (
              <WatchlistRow
                key={s.symbol}
                stock={s}
                active={selectedSymbol === s.symbol}
                onClick={() => onSelectSymbol?.(s.symbol)}
              />
            ))
          ) : (
            <div className="watchlist-empty-state">No stocks match your search.</div>
          )}
        </div>
      </div>

      <div className="watchlist-section">
        <div className="watchlist-section-title">SENSEX</div>
        <div className="watchlist-list">
          {grouped.SENSEX.length > 0 ? (
            grouped.SENSEX.map((s) => (
              <WatchlistRow
                key={s.symbol}
                stock={s}
                active={selectedSymbol === s.symbol}
                onClick={() => onSelectSymbol?.(s.symbol)}
              />
            ))
          ) : (
            <div className="watchlist-empty-state">No stocks match your search.</div>
          )}
        </div>
      </div>
    </aside>
  )
}

function WatchlistRow({ stock, active, onClick }) {
  const changeClass =
    stock.change_percent > 0 ? 'watchlist-change-pos' : stock.change_percent < 0 ? 'watchlist-change-neg' : ''

  return (
    <button
      type="button"
      className={`watchlist-row ${active ? 'watchlist-row-active' : ''}`}
      onClick={onClick}
    >
      <div className="watchlist-row-main">
        <span className="watchlist-symbol">{stock.symbol}</span>
        <span className="watchlist-price">{stock.last_price?.toFixed(2) ?? '--'}</span>
      </div>
      <div className="watchlist-row-sub">
        <span className="watchlist-name">{stock.name}</span>
        <span className={`watchlist-change ${changeClass}`}>
          {stock.change_percent?.toFixed(2) ?? '0.00'}
          %
        </span>
      </div>
      {stock.delayed && <span className="watchlist-delayed">Delayed</span>}
    </button>
  )
}

