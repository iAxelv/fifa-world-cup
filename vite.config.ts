import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/]react/,
              priority: 30
            },
            {
              name: 'firebase-auth',
              test: /node_modules[\\/]firebase[\\/]auth/,
              priority: 26
            },
            {
              name: 'firebase-firestore',
              test: /node_modules[\\/]firebase[\\/]firestore/,
              priority: 25
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10
            }
          ]
        }
      }
    }
  },
  server: {
    port: 3000
  }
})