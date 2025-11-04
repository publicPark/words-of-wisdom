'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setMessage('')
      setMessageType(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setMessage('Please enter your email address')
      setMessageType('error')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setMessage('Please enter a valid email address')
      setMessageType('error')
      return
    }

    setLoading(true)
    setMessage('')
    setMessageType(null)

    const supabase = createClient()
    const origin = window.location.origin
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      setMessageType('error')
    } else {
      setMessage('Check your email for the magic link!')
      setMessageType('success')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-100">Sign in</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-slate-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              disabled={loading}
              autoFocus
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                messageType === 'error'
                  ? 'bg-red-900/30 border border-red-800 text-red-200'
                  : 'bg-green-900/30 border border-green-800 text-green-200'
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-neutral-400 text-center">
          We'll send you a magic link to sign in
        </p>
      </div>
    </div>
  )
}

