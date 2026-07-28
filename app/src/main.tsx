import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import ErrorBoundary from "@/components/ErrorBoundary"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <TRPCProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </TRPCProvider>
    </HashRouter>
  </StrictMode>,
)
