import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminApp from './AdminApp.tsx'
import { StaffProvider } from './staff/StaffProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StaffProvider>
      <AdminApp />
    </StaffProvider>
  </StrictMode>,
)
