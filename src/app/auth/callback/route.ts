import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Authentication callback handler
 * Handles magic link authentication callbacks
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Default redirect to home
  const next = searchParams.get('next') || '/'

  // Handle authentication errors
  if (error) {
    console.error('Auth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(error)}`)
  }

  // Handle authentication code exchange
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // Success - redirect to home or next page
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('Failed to exchange auth code:', exchangeError.message)
      return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(exchangeError.message)}`)
    }
  }

  // No code and no error - invalid request
  return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent('No authentication code provided')}`)
}

