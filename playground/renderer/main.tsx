import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { locale } from './i18n'
import './styles.css'

document.documentElement.lang = locale

if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('playground: #root is missing')
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
