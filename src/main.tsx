import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CustomerApp from './CustomerApp.tsx'
import { ShopProvider } from './shop/ShopProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShopProvider>
      <CustomerApp />
    </ShopProvider>
  </StrictMode>,
)
