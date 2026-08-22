import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './components/Dashboard.tsx'
import './index.css'

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, componentStack: info.componentStack }),
    }).catch(() => undefined)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', background: '#0a0b0d', color: '#f8fafc', padding: 32, fontFamily: 'monospace' }}>
          <h1 style={{ color: '#ef4444' }}>TwinForge interface error</h1>
          <p>The simulator server is still running. The interface encountered:</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#fca5a5' }}>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 14px', marginTop: 12 }}>Reload interface</button>
        </main>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><Dashboard /></AppErrorBoundary>
  </React.StrictMode>,
)
