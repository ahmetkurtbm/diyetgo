import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { UpdatePrompt } from './components/layout/UpdatePrompt'
import { createDataSource } from './data'
import { StartupErrorPage } from './features/startup/StartupErrorPage'

const source = createDataSource()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {source.ok ? (
      <App repositories={source.repositories} />
    ) : (
      <StartupErrorPage
        message={source.kind === 'demo_storage' ? source.error.message : source.message}
        onReset={
          source.kind === 'demo_storage'
            ? () => {
                source.resetStorage()
                window.location.reload()
              }
            : undefined
        }
      />
    )}
    <UpdatePrompt />
  </StrictMode>,
)
