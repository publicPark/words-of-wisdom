import NotesPageClient from './NotesPageClient'
import { createClient } from '@/lib/supabase/server'

const NOTES_PER_PAGE = 20

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page = '1' } = await searchParams
  const currentPage = parseInt(page, 10) || 1
  const offset = (currentPage - 1) * NOTES_PER_PAGE

  const supabase = await createClient()
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id,title,is_public,created_at,updated_at,created_by,sentences(count)')
    .order('updated_at', { ascending: false })
    .range(offset, offset + NOTES_PER_PAGE - 1)

  // 총 개수 조회
  const { count } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })

  const totalNotes = count || 0
  const totalPages = Math.ceil(totalNotes / NOTES_PER_PAGE)

  const normalizedNotes = (notes || []).map((n: any) => ({
    ...n,
    sentence_count: Array.isArray(n?.sentences) && n.sentences[0]?.count ? n.sentences[0].count : 0,
  }))

  return (
    <NotesPageClient
      initialNotes={normalizedNotes}
      initialPage={currentPage}
      totalPages={totalPages}
      totalNotes={totalNotes}
    />
  )
}


