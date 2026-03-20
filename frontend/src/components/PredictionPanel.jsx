export default function PredictionPanel({ symbol, insight, history }) {
  const directionClass =
    insight?.direction === 'UP' ? 'pred-direction-up' : insight?.direction === 'DOWN' ? 'pred-direction-down' : ''

  // Get recommendation styling based on recommendation type
  const getRecommendationStyle = (rec) => {
    if (!rec) return 'pred-rec-neutral'
    if (rec === 'BUY') return 'pred-rec-buy'
    if (rec === 'SELL') return 'pred-rec-sell'
    if (rec === 'HOLD') return 'pred-rec-hold'
    return 'pred-rec-wait'
  }

  const getRecommendationEmoji = (rec) => {
    if (rec === 'BUY') return '🟢'
    if (rec === 'SELL') return '🔴'
    if (rec === 'HOLD') return '🟡'
    if (rec === 'WAIT') return '⚪'
    return '❓'
  }

  return (
    <aside className="pred-root">
      <div className="pred-header">
        <h2>Prediction Insights</h2>
      </div>

      {/* Trading Recommendation Card */}
      {insight?.recommendation && (
        <div className={`pred-recommendation ${getRecommendationStyle(insight.recommendation)}`}>
          <div className="pred-rec-title">
            <span className="pred-rec-emoji">{getRecommendationEmoji(insight.recommendation)}</span>
            <span className="pred-rec-text">{insight.recommendation}</span>
          </div>
          <div className="pred-rec-reason">{insight.recommendation_reason}</div>
        </div>
      )}

      <div className="pred-card">
        <div className="pred-label">Symbol</div>
        <div className="pred-value pred-symbol">{symbol}</div>

        <div className="pred-grid">
          <div>
            <div className="pred-label">Current Price</div>
            <div className="pred-value">{insight?.current_price?.toFixed(2) ?? '--'}</div>
          </div>
          <div>
            <div className="pred-label">Next Prediction Direction</div>
            <div className={`pred-value ${directionClass}`}>{insight?.direction ?? '--'}</div>
          </div>
        </div>
      </div>

      <div className="pred-history">
        <div className="pred-history-header">
          <h3>Prediction History (15m)</h3>
          <span className="pred-history-accuracy">
            Accuracy:{' '}
            {history && history.filter(h => h.correct !== null && h.correct !== undefined).length
              ? `${Math.round(
                  (history.filter((h) => h.correct === true).length / history.filter(h => h.correct !== null && h.correct !== undefined).length) * 100,
                )}%`
              : '--'}
          </span>
        </div>
        <div className="pred-history-table">
          <div className="pred-history-row pred-history-row-header">
            <span>Time</span>
            <span>Pred</span>
            <span>Actual</span>
            <span>Dir</span>
            <span>Result</span>
          </div>
          {history?.filter((h) => h.correct === true || h.correct === false).map((h) => {
            const timeDate = new Date(h.prediction_time_epoch * 1000)
            const timeStr = timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return (
            <div key={h.id} className="pred-history-row">
              <span title={timeDate.toLocaleString()}>{timeStr}</span>
              <span>{h.predicted_price?.toFixed(2) ?? '--'}</span>
              <span>{h.actual_price != null ? h.actual_price.toFixed(2) : '--'}</span>
              <span>{h.direction}</span>
              <span className={h.correct ? 'pred-history-ok' : 'pred-history-bad'}>
                {h.correct ? 'Correct' : 'Wrong'}
              </span>
            </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

