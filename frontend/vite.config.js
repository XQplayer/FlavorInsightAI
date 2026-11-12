import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_PCA_PREVIEW === 'true' ? '/' : '/FlavorInsightAI/',
  plugins: [react(), tailwindcss()],
})
