import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', color: 'var(--text)', background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', color: 'var(--red)', marginBottom: '16px' }}>System Critical Error</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>An unexpected error occurred in the Sentinel application.</p>
          <pre style={{ background: 'rgba(5,5,14,0.8)', padding: '16px', borderRadius: '8px', color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', maxWidth: '80%', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '24px', background: 'var(--amber)', color: '#1a1a2e', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Restart System
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
