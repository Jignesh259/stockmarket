import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

const LandingPage = () => {
  const [loading, setLoading] = useState(true);
  const cardsRef = useRef([]);
  const cursorDotRef = useRef(null);
  const cursorOutlineRef = useRef(null);
  const magneticRefs = useRef([]);

  useEffect(() => {
    // Initial loading delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // Custom Cursor Logic
    const moveCursor = (e) => {
      if (cursorDotRef.current) {
        cursorDotRef.current.style.left = `${e.clientX}px`;
        cursorDotRef.current.style.top = `${e.clientY}px`;
      }
      if (cursorOutlineRef.current) {
        cursorOutlineRef.current.animate({
          left: `${e.clientX}px`,
          top: `${e.clientY}px`
        }, { duration: 500, fill: "forwards" });
      }
    };

    window.addEventListener('mousemove', moveCursor);

    // Magnetic Logic
    const handleMagnetic = (e) => {
      magneticRefs.current.forEach(ref => {
        if (!ref) return;
        const { left, top, width, height } = ref.getBoundingClientRect();
        const x = e.clientX - (left + width / 2);
        const y = e.clientY - (top + height / 2);
        const distance = Math.sqrt(x * x + y * y);

        if (distance < 100) {
          ref.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
          cursorOutlineRef.current?.classList.add('hovering');
        } else {
          ref.style.transform = `translate(0, 0)`;
          cursorOutlineRef.current?.classList.remove('hovering');
        }
      });
    };

    window.addEventListener('mousemove', handleMagnetic);

    // Parallax Scroll Logic
    const handleScroll = () => {
      document.body.style.setProperty('--scroll-y', `${window.scrollY * 0.2}px`);
    };
    window.addEventListener('scroll', handleScroll);

    // Intersection Observer for cards
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mousemove', handleMagnetic);
      observer.disconnect();
    };
  }, []);

  const stocks = [
    { s: 'RELIANCE', p: '+2.4%', up: true },
    { s: 'TCS', p: '-0.8%', up: false },
    { s: 'INFY', p: '+1.5%', up: true },
    { s: 'HDFCBANK', p: '+3.1%', up: true },
    { s: 'ICICIBANK', p: '-1.2%', up: false },
    { s: 'BHARTIARTL', p: '+0.7%', up: true },
    { s: 'AXISBANK', p: '+2.1%', up: true },
    { s: 'WIPRO', p: '-2.3%', up: false },
  ];

  return (
    <div className="landing-root">
      <div className={`loader-wrapper ${!loading ? 'hidden' : ''}`}>
        <div className="loader-logo">STOCK</div>
        <div className="loader-bar-bg">
          <div className="loader-bar-fill"></div>
        </div>
      </div>

      <div className="cursor-dot" ref={cursorDotRef}></div>
      <div className="cursor-outline" ref={cursorOutlineRef}></div>
      <div className="parallax-grid"></div>
      
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-subtitle">Advanced Analysis</div>
          <h1 className="hero-title">STOCK<br/>PREDICTION</h1>
          <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '0 auto 40px' }}>
            Leverage high-precision AI models to stay ahead of the market. 
            Real-time insights for the next generation of traders.
          </p>
          <div className="magnetic-wrap" ref={el => magneticRefs.current[0] = el}>
            <Link to="/dashboard" className="cta-button">
              Enter Dashboard 
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <div className="ticker-strip">
        <div className="ticker-content">
          {[...stocks, ...stocks].map((stock, i) => (
            <div key={i} className="ticker-item">
              <span>{stock.s}</span>
              <span className={stock.up ? 'up' : 'down'}>{stock.p}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="drops-section">
        <div className="editorial-header">MARKET</div>
        <div className="section-head" style={{ textAlign: 'left', marginBottom: '60px' }}>
          <h2 className="section-title" style={{ color: 'black' }}>Latest Drops</h2>
          <p style={{ color: '#666' }}>High-performance predictions, curated daily.</p>
        </div>

        <div className="drops-grid">
          {[
            { s: 'RELIANCE', c: '$2,940', v: 'HIGH', t: 'BLUE CHIP' },
            { s: 'TCS', c: '$4,120', v: 'MEDIUM', t: 'TECH' },
            { s: 'ZOMATO', c: '$198', v: 'EXTREME', t: 'GROWTH' },
            { s: 'TATASTEEL', c: '$152', v: 'STEADY', t: 'METAL' },
          ].map((drop, i) => (
            <div key={i} className="drop-card">
              <div className="drop-tag">{drop.t}</div>
              <div className="drop-symbol">{drop.s}</div>
              <div className="drop-info">
                <span>PRICE: {drop.c}</span>
                <span>VOL: {drop.v}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="features">
        <div className="section-head">
          <h2 className="section-title">Market Dominance</h2>
          <p style={{ color: '#94a3b8' }}>Tools engineered for precision and performance.</p>
        </div>

        <div className="grid">
          {[
            {
              title: 'AI Predictions',
              desc: 'Deep learning models processing 100+ variables for 15-minute interval accuracy.',
              icon: '🚀'
            },
            {
              title: 'Live Charts',
              desc: 'Ultra-responsive lightweight charts with real-time candle updates.',
              icon: '📊'
            },
            {
              title: 'Smart Watchlist',
              desc: 'Intelligent filtering and one-click access to top performing NSE stocks.',
              icon: '⚡'
            }
          ].map((f, i) => (
            <div 
              key={i} 
              className="card" 
              ref={el => cardsRef.current[i] = el}
            >
              <div className="card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div className="mini-chart">
                {[40, 70, 45, 90, 65, 80, 50].map((h, j) => (
                  <div key={j} className="bar" style={{ height: `${h}%`, opacity: 0.3 + (h/100) }}></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="roadmap">
        <div className="section-head">
          <h2 className="section-title">The Roadmap</h2>
          <p style={{ color: '#94a3b8' }}>Our journey towards financial singularity.</p>
        </div>
        <div className="roadmap-line"></div>
        {[
          { q: 'Q1 2026', t: 'Beta Launch', d: 'Public release of NSE stock predictions.' },
          { q: 'Q2 2026', t: 'Advanced NLP', d: 'Sentiment analysis from global news feeds.' },
          { q: 'Q3 2026', t: 'Portfolio Auto-Pilot', d: 'Automated strategy execution layer.' },
          { q: 'Q4 2026', t: 'Global Markets', d: 'Expansion to NYSE and Crypto assets.' },
        ].map((item, i) => (
          <div key={i} className="roadmap-item">
            <div className="roadmap-content">
              <div style={{ color: '#3b82f6', fontWeight: 'bold', marginBottom: '8px' }}>{item.q}</div>
              <h3>{item.t}</h3>
              <p>{item.d}</p>
            </div>
            <div className="roadmap-dot"></div>
          </div>
        ))}
      </section>

      <div className="stats">
        <div className="stat-item">
          <span className="stat-value">99.2%</span>
          <span className="stat-label">Model Uptime</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">15m</span>
          <span className="stat-label">Update Interval</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">50+</span>
          <span className="stat-label">NSE Stocks</span>
        </div>
      </div>

      <footer style={{ padding: '100px 20px', textAlign: 'center', background: 'linear-gradient(to top, rgba(59, 130, 246, 0.05), transparent)' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '30px' }}>Ready to analyze?</h2>
        <div className="magnetic-wrap" ref={el => magneticRefs.current[1] = el}>
          <Link to="/dashboard" className="cta-button">
            Start Predicting Now
          </Link>
        </div>
        <p style={{ marginTop: '60px', color: '#475569', fontSize: '0.9rem' }}>
          &copy; 2026 Stock Prediction. Inspired by Excellence.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
