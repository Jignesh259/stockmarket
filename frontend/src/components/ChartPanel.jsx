import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'

export default function ChartPanel({ symbol, candles, predictions, marketClosed }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const lineSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const predictionLineSeriesRef = useRef(null)
  const actualLineSeriesRef = useRef(null)
  const predictionMarkersRef = useRef([])
  
  const [chartType, setChartType] = useState('candlestick')

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return
    if (chartRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#050712' },
        textColor: '#d5dde5',
      },
      grid: {
        vertLines: { color: 'rgba(70, 78, 94, 0.3)' },
        horzLines: { color: 'rgba(70, 78, 94, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(70, 78, 94, 0.6)',
      },
      timeScale: {
        borderColor: 'rgba(70, 78, 94, 0.6)',
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
    })

    const lineSeries = chart.addLineSeries({
      color: '#2962ff',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
      },
    })

    const volumeSeries = chart.addHistogramSeries({
      color: '#394b59',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    const predictionSeries = chart.addLineSeries({
      color: '#ffd700',
      lineWidth: 2,
      lineStyle: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
      },
    })

    const actualSeries = chart.addLineSeries({
      color: '#1e90ff',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
      },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    lineSeriesRef.current = lineSeries
    volumeSeriesRef.current = volumeSeries
    predictionLineSeriesRef.current = predictionSeries
    actualLineSeriesRef.current = actualSeries

    let resizeTimeout = null
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!containerRef.current || !chartRef.current) return
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }, 200)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) clearTimeout(resizeTimeout)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      lineSeriesRef.current = null
      volumeSeriesRef.current = null
      predictionLineSeriesRef.current = null
      actualLineSeriesRef.current = null
    }
  }, [])


  useEffect(() => {
    if (!candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current) return
    if (!candles || candles.length === 0) return

    const candleData = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    const lineData = candles.map((c) => ({
      time: c.time,
      value: (c.open + c.high + c.low + c.close) / 4,
    }))

    const volumeData = candles.map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38, 166, 154, 0.7)' : 'rgba(239, 83, 80, 0.7)',
    }))

    if (chartType === 'candlestick') {
      candleSeriesRef.current.setData(candleData)
      lineSeriesRef.current.setData([])
    } else {
      candleSeriesRef.current.setData([])
      lineSeriesRef.current.setData(lineData)
    }

    volumeSeriesRef.current.setData(volumeData)
  }, [candles, chartType])

  useEffect(() => {
    if (!predictionLineSeriesRef.current || !actualLineSeriesRef.current) return
    if (!predictions || predictions.length === 0) return

    const sortedPredictions = [...predictions].sort((a, b) => a.time - b.time)

    // Create data for prediction vs actual overlay
    const predictionData = sortedPredictions
      .filter(p => p.time && p.direction)
      .map((p) => {
        const candleAtTime = candles?.find(c => c.time === p.time)
        const predictedPrice = candleAtTime 
          ? (p.direction === 'UP' 
              ? candleAtTime.close * 1.002 
              : candleAtTime.close * 0.998)
          : null
        
        return {
          time: p.time,
          value: predictedPrice,
        }
      })
      .filter(p => p.value !== null)

    // Create data for actual prices from candles
    const actualData = candles.map((c) => ({
      time: c.time,
      value: c.close,
    }))

    predictionLineSeriesRef.current.setData(predictionData)
    actualLineSeriesRef.current.setData(actualData)

    // Add markers for predictions
    predictionMarkersRef.current = sortedPredictions.map((p) => ({
      time: p.time,
      position: 'aboveBar',
      color: p.correct === true ? '#26a69a' : p.correct === false ? '#ef5350' : '#fdd835',
      shape: 'arrowDown',
      text: `${p.direction === 'UP' ? '↑' : '↓'} (${Math.round(p.confidence * 100)}%)`,
    }))

    if (chartType === 'candlestick' && candleSeriesRef.current) {
      candleSeriesRef.current.setMarkers(predictionMarkersRef.current)
    }
  }, [predictions, candles, chartType])

  const handleChartTypeToggle = () => {
    setChartType(chartType === 'candlestick' ? 'line' : 'candlestick')
  }

  return (
    <section className="chart-root">
      <div className="chart-header">
        <div className="chart-title">
          <span className="chart-symbol">{symbol}</span>
          <span className="chart-market-status" style={{ color: marketClosed ? '#ef5350' : '#26a69a' }}>
            {marketClosed ? '🔴 Market Closed' : '🟢 Market Open'}
          </span>
        </div>
        
        <div className="chart-controls">
          <div className="chart-type-selector">
            <button 
              type="button" 
              className={`chart-type-btn ${chartType === 'candlestick' ? 'active' : ''}`}
              onClick={handleChartTypeToggle}
              disabled={marketClosed}
            >
              📊 Candlestick
            </button>
            <button 
              type="button" 
              className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={handleChartTypeToggle}
              disabled={marketClosed}
            >
              📈 Line
            </button>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="chart-container" />

      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#1e90ff' }}></span>
          <span>Actual Price</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#ffd700' }}></span>
          <span>Predicted Price</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#26a69a' }}></span>
          <span>UP ✓</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#ef5350' }}></span>
          <span>DOWN ✗</span>
        </div>
      </div>
    </section>
  )
}

