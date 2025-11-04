'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  userEmail: string | null
  userId: string | null
  isAuthed: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
  initialUser: User | null
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  // 서버에서 받은 초기 사용자 정보로 시작 (화면 깜빡임 방지)
  const [user, setUser] = useState<User | null>(initialUser)
  const userEmail = user?.email ?? null
  const userId = user?.id ?? null
  const isAuthed = !!user

  useEffect(() => {
    const supabase = createClient()

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 서버에서 받은 초기 사용자 정보가 변경될 때 동기화 (예: 다른 탭에서 로그인)
  useEffect(() => {
    setUser(initialUser)
  }, [initialUser])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userEmail,
        userId,
        isAuthed,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

