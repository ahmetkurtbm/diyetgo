import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito-sans'
import '@fontsource-variable/lora'
import './index.css'
import { UpdatePrompt } from './components/layout/UpdatePrompt'
import { createDataSource } from './data'
import { Root } from './Root'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root source={createDataSource()} />
    <UpdatePrompt />
  </StrictMode>,
)
