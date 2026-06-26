import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import Title from './components/Title/Title.tsx'
import Background from './components/Background/Background.tsx'
import Menu from './components/Menu/Menu.tsx'
import { auth } from './firebase.ts'
import './App.css'

function App() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const keyBufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const sequenceStartRef = useRef(0)

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Keep default auth persistence if explicit persistence fails.
    })

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(Boolean(user))
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const now = Date.now()

      if (!/^[a-z]$/.test(key)) {
        return
      }

      if (now - lastKeyTimeRef.current > 1000) {
        keyBufferRef.current = ''
      }

      if (keyBufferRef.current.length === 0) {
        sequenceStartRef.current = now
      }

      keyBufferRef.current += key
      lastKeyTimeRef.current = now

      if (!'admin'.startsWith(keyBufferRef.current)) {
        keyBufferRef.current = key === 'a' ? 'a' : ''
      }

      if (keyBufferRef.current === 'admin') {
        if (now - sequenceStartRef.current <= 3000) {
          setShowLoginModal(true)
          setLoginError('')
        }
        keyBufferRef.current = ''
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      setShowLoginModal(false)
      setEmail('')
      setPassword('')
    } catch {
      setLoginError('Credenciales invalidas o sin permisos de administrador.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <div className="app-container">
      <Title />
      <Menu isAdmin={isAdmin} onLogout={handleLogout} />
      <Background />

      {showLoginModal && (
        <div className="admin-login-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="admin-login-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Acceso Administrador</h3>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {loginError && <p className="admin-login-error">{loginError}</p>}
              <button type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App