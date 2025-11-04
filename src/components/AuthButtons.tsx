'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginModal from './LoginModal'

export default function AuthButtons() {
  const { userEmail, signOut } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (userEmail) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-400">{userEmail}</span>
        <button className="btn btn-secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
        Sign in
      </button>
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}


