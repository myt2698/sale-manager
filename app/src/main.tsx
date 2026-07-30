import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import ErrorBoundary from "@/components/ErrorBoundary"
import App from './App.tsx'

const isBusinessKey = (key: string) =>
  key.startsWith('sales-sys-') || key === 'filename-generator-history'

async function bootstrap() {
  if (window.desktopAPI) {
    try {
      const state = await window.desktopAPI.loadState()
      for (const [key, value] of Object.entries(state)) {
        if (isBusinessKey(key)) localStorage.setItem(key, value)
      }

      const originalSetItem = Storage.prototype.setItem
      const originalRemoveItem = Storage.prototype.removeItem
      let saveTimer: number | undefined
      const scheduleSave = () => {
        window.clearTimeout(saveTimer)
        saveTimer = window.setTimeout(() => {
          const snapshot: Record<string, string> = {}
          for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index)
            if (key && isBusinessKey(key)) {
              const value = localStorage.getItem(key)
              if (value !== null) snapshot[key] = value
            }
          }
          void window.desktopAPI?.saveState(snapshot)
        }, 150)
      }
      Storage.prototype.setItem = function (key: string, value: string) {
        originalSetItem.call(this, key, value)
        if (this === localStorage && isBusinessKey(key)) scheduleSave()
      }
      Storage.prototype.removeItem = function (key: string) {
        originalRemoveItem.call(this, key)
        if (this === localStorage && isBusinessKey(key)) scheduleSave()
      }
    } catch (error) {
      console.error('加载桌面数据失败', error)
    }
  }

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
}

void bootstrap()
