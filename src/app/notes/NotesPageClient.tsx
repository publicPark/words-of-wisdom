'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  createGuestNote,
  deleteGuestNote,
  updateGuestNote,
  listGuestNotes,
  listGuestSentences,
  clearAllGuestData,
  addGuestSentence,
  type GuestNote,
} from '@/lib/guestStorage'
import { Badge } from '@/components/Badge'

type Note = {
  id: string
  title: string
  is_public?: boolean
  created_at: string
  updated_at: string
  created_by?: string
  sentence_count?: number
}

interface NotesPageClientProps {
  initialNotes: Note[]
  initialPage: number
  totalPages: number
  totalNotes: number
}

const NOTES_PER_PAGE = 20

export default function NotesPageClient({
  initialNotes,
  initialPage,
  totalPages,
  totalNotes,
}: NotesPageClientProps) {
  const { isAuthed, userId } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [guestNotes, setGuestNotes] = useState<GuestNote[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [makePublic, setMakePublic] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteTitle, setEditNoteTitle] = useState<string>('')
  const [editNotePublic, setEditNotePublic] = useState<boolean>(false)
  const fileInputId = 'import-sentences-input'

  const handleImportSentences = async (file: File | null) => {
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const version = typeof json?.version === 'number' ? json.version : 1
      if (version < 1 || !Array.isArray(json?.sentences)) {
        setLastError('Invalid import file: missing sentences')
        return
      }

      const rawTitle = typeof json?.title === 'string' ? json.title : ''
      const titleToUse = rawTitle?.trim() || `Imported Sentences - ${new Date().toISOString().slice(0,10)}`
      const newNote = createGuestNote(titleToUse)

      let created = 0
      for (const s of json.sentences as any[]) {
        const st = typeof s?.title === 'string' ? s.title.trim() : ''
        if (!st) continue
        const desc = s?.description == null ? null : String(s.description)
        const lvlRaw = Number(s?.mastery_level)
        const lvl = lvlRaw === 2 || lvlRaw === 3 ? lvlRaw : 1
        addGuestSentence({ note_id: newNote.id, title: st, description: desc, mastery_level: lvl as 1|2|3 })
        created++
      }

      setGuestNotes(listGuestNotes())
      setLastError(null)
      alert(`Imported ${created} sentences into "${newNote.title}"`)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Failed to import file')
    }
  }

  const loadNotes = async (page: number = currentPage) => {
    setLoading(true)
    const supabase = createClient()
    const offset = (page - 1) * NOTES_PER_PAGE
    const { data, error } = await supabase
      .from('notes')
      .select('id,title,is_public,created_at,updated_at,created_by,sentences(count)')
      .order('updated_at', { ascending: false })
      .range(offset, offset + NOTES_PER_PAGE - 1)
    
    if (!error && data) {
      const normalized = (data as any[]).map((n) => ({
        ...n,
        sentence_count: Array.isArray(n?.sentences) && n.sentences[0]?.count ? n.sentences[0].count : 0,
      })) as Note[]
      setNotes(normalized)
      setCurrentPage(page)
    }
    setLoading(false)
  }

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return
    
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', newPage.toString())
      router.push(`/notes?${params.toString()}`)
      loadNotes(newPage)
    })
  }

  const createNote = async () => {
    if (!title.trim()) { setLastError('Please enter a note title.'); return }
    setLoading(true)
    if (isAuthed && userId) {
      const supabase = createClient()
      const { error } = await supabase.from('notes').insert({ title, is_public: makePublic, created_by: userId })
      setLoading(false)
      if (!error) {
        setTitle('')
        setMakePublic(false)
        setLastError(null)
        // 새 노트는 첫 페이지로 이동
        router.push('/notes?page=1')
        await loadNotes(1)
      } else {
        setLastError(error.message || 'Failed to create note')
      }
    } else {
      const n = createGuestNote(title)
      setGuestNotes((prev) => [n, ...prev])
      setTitle('')
      setLastError(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    // SSR에서 받은 초기 데이터 사용
    setNotes(initialNotes)
    setCurrentPage(initialPage)
    setGuestNotes(listGuestNotes())
  }, [initialNotes, initialPage, isAuthed])

  // URL의 page 파라미터 변경 감지
  useEffect(() => {
    const pageParam = searchParams.get('page')
    const page = pageParam ? parseInt(pageParam, 10) : 1
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      loadNotes(page)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const migrateGuestNotes = async () => {
    if (!isAuthed || !userId || guestNotes.length === 0) return
    
    setMigrating(true)
    setLastError(null)
    
    try {
      const supabase = createClient()
      const allGuestSentences = listGuestSentences()
      
      // 각 게스트 노트를 서버로 마이그레이션
      for (const guestNote of guestNotes) {
        // 노트 생성
        const { data: newNote, error: noteError } = await supabase
          .from('notes')
          .insert({
            title: guestNote.title,
            is_public: false,
            created_by: userId,
          })
          .select()
          .single()
        
        if (noteError || !newNote) {
          throw new Error(`Failed to migrate note "${guestNote.title}": ${noteError?.message || 'Unknown error'}`)
        }
        
        // 해당 노트의 문장들 마이그레이션
        const noteSentences = allGuestSentences.filter(s => s.note_id === guestNote.id)
        if (noteSentences.length > 0) {
          const sentencesToInsert = noteSentences.map(s => ({
            note_id: newNote.id,
            title: s.title,
            description: s.description,
            mastery_level: s.mastery_level,
            created_by: userId,
          }))
          
          const { error: sentencesError } = await supabase
            .from('sentences')
            .insert(sentencesToInsert)
          
          if (sentencesError) {
            throw new Error(`Failed to migrate sentences for "${guestNote.title}": ${sentencesError.message}`)
          }
        }
      }
      
      // 모든 게스트 데이터 삭제
      clearAllGuestData()
      setGuestNotes([])
      
      // 서버 노트 다시 로드 (첫 페이지로 이동)
      router.push('/notes?page=1')
      await loadNotes(1)
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to migrate guest notes')
    } finally {
      setMigrating(false)
    }
  }

  const startEditNote = (noteId: string, currentTitle: string, currentPublic: boolean = false) => {
    setEditingNoteId(noteId)
    setEditNoteTitle(currentTitle)
    setEditNotePublic(currentPublic)
  }

  const cancelEditNote = () => {
    setEditingNoteId(null)
    setEditNoteTitle('')
    setEditNotePublic(false)
  }

  const saveNoteEdit = async (noteId: string) => {
    if (!editNoteTitle.trim()) {
      setLastError('Please enter a note title.')
      return
    }

    setLoading(true)
    setLastError(null)

    try {
      if (noteId.startsWith('guest-')) {
        // 게스트 노트 수정
        updateGuestNote(noteId, { title: editNoteTitle.trim() })
        setGuestNotes(listGuestNotes())
        cancelEditNote()
      } else {
        // 서버 노트 수정
        if (!isAuthed || !userId) {
          setLastError('You must be signed in to edit notes.')
          setLoading(false)
          return
        }
        
        const supabase = createClient()
        // RLS 정책이 이미 본인 노트만 수정 가능하도록 보장하므로 created_by 체크는 불필요
        const { data, error } = await supabase
          .from('notes')
          .update({ 
            title: editNoteTitle.trim(),
            is_public: editNotePublic
          })
          .eq('id', noteId)
          .select()

        if (error) {
          console.error('Failed to update note:', error)
          setLastError(error.message || 'Failed to update note')
        } else if (data && data.length > 0) {
          // 수정 성공 - 현재 페이지 다시 로드
          await loadNotes(currentPage)
          cancelEditNote()
        } else {
          // 수정된 행이 없음 (RLS 정책에 의해 차단되었거나 노트가 없음)
          setLastError('Failed to update note. You may not have permission to edit this note.')
        }
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to update note')
    } finally {
      setLoading(false)
    }
  }

  const togglePublic = async (noteId: string, currentPublic: boolean) => {
    if (noteId.startsWith('guest-')) {
      // 게스트 노트는 public 설정 불가
      return
    }

    if (!isAuthed || !userId) {
      setLastError('You must be signed in to change note visibility.')
      return
    }

    setLoading(true)
    setLastError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notes')
        .update({ is_public: !currentPublic })
        .eq('id', noteId)
        .select()

      if (error) {
        console.error('Failed to update note visibility:', error)
        setLastError(error.message || 'Failed to update note visibility')
      } else if (data && data.length > 0) {
        // 수정 성공 - 현재 페이지 다시 로드
        await loadNotes(currentPage)
      } else {
        setLastError('Failed to update note visibility. You may not have permission.')
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to update note visibility')
    } finally {
      setLoading(false)
    }
  }

  const combined = useMemo(() => {
    return [...guestNotes, ...notes]
  }, [guestNotes, notes])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notes</h1>
      </div>

      {!isAuthed && (
        <div className="text-sm p-3 rounded-md bg-yellow-100 text-yellow-900 border border-yellow-300">
          Not signed in: creating local guest notes. Public notes are visible.
        </div>
      )}

      {isAuthed && guestNotes.length > 0 && (
        <div className="text-sm p-3 rounded-md bg-blue-100 text-blue-900 border border-blue-300 flex items-center justify-between">
          <span>
            You have {guestNotes.length} guest note{guestNotes.length > 1 ? 's' : ''} stored locally. 
            Migrate them to your account to sync across devices.
          </span>
          <button
            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={migrateGuestNotes}
            disabled={migrating}
          >
            {migrating ? 'Migrating...' : 'Migrate to Server'}
          </button>
        </div>
      )}

      <section className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-800">New note title</label>
        <input
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
          placeholder="e.g. Travel phrases"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {isAuthed && (
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={makePublic}
              onChange={(e) => setMakePublic(e.target.checked)}
              className="h-4 w-4"
            />
            Make public (anyone can view)
          </label>
        )}
      {lastError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {lastError}
        </div>
      )}
        <div className="flex gap-2 justify-end">
          <button
            className="btn btn-primary"
            onClick={createNote}
            disabled={loading}
          >
            Add
          </button>
        </div>
      </section>

      {/* Guest import button moved outside the card */}
      {!isAuthed && (
        <div className="mt-2 flex justify-end">
          <input
            id={fileInputId}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImportSentences(e.target.files?.[0] || null)}
          />
          <button
            className="text-xs text-gray-400 hover:text-gray-200 hover:underline"
            onClick={() => document.getElementById(fileInputId)?.click()}
            disabled={loading}
          >
            Import (JSON)
          </button>
        </div>
      )}

      <section className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm">
        {(loading || isPending) && (
          <div className="p-4 text-center text-gray-400">
            Loading notes...
          </div>
        )}
        <ul className="divide-y">
          {combined.map((n) => {
            // 게스트 노트는 항상 수정 가능, 서버 노트는 본인 것만 수정 가능
            const canEdit = n.id.startsWith('guest-') || (isAuthed && userId && 'created_by' in n && n.created_by === userId)
            const isEditing = editingNoteId === n.id

            return (
              <li key={n.id} className="p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={editNoteTitle}
                        onChange={(e) => setEditNoteTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveNoteEdit(n.id)
                          } else if (e.key === 'Escape') {
                            cancelEditNote()
                          }
                        }}
                        autoFocus
                        placeholder="Note title"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {!n.id.startsWith('guest-') && (
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editNotePublic}
                              onChange={(e) => setEditNotePublic(e.target.checked)}
                              disabled={loading}
                              className="h-4 w-4"
                            />
                            <span>Make public (anyone can view)</span>
                          </label>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => saveNoteEdit(n.id)}
                          disabled={loading}
                        >
                          Save
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          onClick={cancelEditNote}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <a className="text-blue-700 hover:underline" href={`/notes/${n.id}`}>
                        {n.title}
                      </a>
                    <span className="text-xs text-gray-500">(
                      {n.id.startsWith('guest-')
                        ? listGuestSentences(n.id).length
                        : (n as any).sentence_count ?? 0}
                    )</span>
                      {'is_public' in n && n.is_public ? (
                        <Badge variant="public">public</Badge>
                      ) : null}
                      {typeof (n as any).is_public === 'undefined' && n.id.startsWith('guest-') ? (
                        <Badge variant="guest">guest</Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          className="text-sm text-blue-700 hover:underline"
                          onClick={() => startEditNote(n.id, n.title, ('is_public' in n ? !!n.is_public : false))}
                        >
                          Edit
                        </button>
                      )}
                      {canEdit && (
                        n.id.startsWith('guest-') ? (
                          <button
                            className="text-sm text-red-700 hover:underline"
                            onClick={() => {
                              if (!confirm(`Are you sure you want to delete "${n.title}"? This will delete the note and all its sentences. This action cannot be undone.`)) {
                                return;
                              }
                              deleteGuestNote(n.id)
                              setGuestNotes(listGuestNotes())
                            }}
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            className="text-sm text-red-700 hover:underline"
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to delete "${n.title}"? This will delete the note and all its sentences. This action cannot be undone.`)) {
                                return;
                              }
                              setLoading(true)
                              setLastError(null)
                              try {
                                const supabase = createClient()
                                const { error } = await supabase.from('notes').delete().eq('id', n.id)
                                if (error) {
                                  setLastError(error.message || 'Failed to delete note. You may not have permission to delete this note.')
                                } else {
                                  await loadNotes(currentPage)
                                }
                              } catch (error) {
                                setLastError(error instanceof Error ? error.message : 'Failed to delete note')
                              } finally {
                                setLoading(false)
                              }
                            }}
                          >
                            Delete
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
          {combined.length === 0 && !loading && !isPending && (
            <li className="p-8 text-center text-gray-600">No notes yet</li>
          )}
        </ul>
        
        {/* 페이징 컨트롤 */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {((currentPage - 1) * NOTES_PER_PAGE) + 1} - {Math.min(currentPage * NOTES_PER_PAGE, totalNotes)} of {totalNotes}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changePage(currentPage - 1)}
                disabled={currentPage === 1 || loading || isPending}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => changePage(currentPage + 1)}
                disabled={currentPage === totalPages || loading || isPending}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

