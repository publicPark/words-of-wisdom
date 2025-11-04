export type GuestNote = {
  id: string // guest-...
  title: string
  created_at: string
  updated_at: string
}

export type GuestSentence = {
  id: string // guest-...
  note_id: string
  title: string
  description: string | null
  mastery_level: 1 | 2 | 3
  created_at: string
  updated_at: string
}

const NOTES_KEY = 'guest_notes'
const SENTENCES_KEY = 'guest_sentences'

export function isStorageAvailable() {
  try {
    const testKey = '__guest_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function safeRandomId() {
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items))
}

export function listGuestNotes(): GuestNote[] {
  return read<GuestNote>(NOTES_KEY)
}

export function createGuestNote(title: string): GuestNote {
  const now = new Date().toISOString()
  const note: GuestNote = { id: `guest-${safeRandomId()}`, title, created_at: now, updated_at: now }
  const all = listGuestNotes()
  all.unshift(note)
  write(NOTES_KEY, all)
  return note
}

export function updateGuestNote(id: string, patch: Partial<GuestNote>) {
  const all = listGuestNotes()
  const idx = all.findIndex(n => n.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
    write(NOTES_KEY, all)
  }
}

export function deleteGuestNote(id: string) {
  write(NOTES_KEY, listGuestNotes().filter(n => n.id !== id))
  write(SENTENCES_KEY, listGuestSentences().filter(s => s.note_id !== id))
}

export function listGuestSentences(noteId?: string): GuestSentence[] {
  const all = read<GuestSentence>(SENTENCES_KEY)
  return noteId ? all.filter(s => s.note_id === noteId) : all
}

export function addGuestSentence(input: Omit<GuestSentence, 'id' | 'created_at' | 'updated_at'>): GuestSentence {
  const now = new Date().toISOString()
  const sentence: GuestSentence = { id: `guest-${safeRandomId()}`, created_at: now, updated_at: now, ...input }
  const all = listGuestSentences()
  all.unshift(sentence)
  write(SENTENCES_KEY, all)
  return sentence
}

export function updateGuestSentence(id: string, patch: Partial<GuestSentence>) {
  const all = listGuestSentences()
  const idx = all.findIndex(s => s.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch, updated_at: new Date().toISOString() }
    write(SENTENCES_KEY, all)
  }
}

export function deleteGuestSentence(id: string) {
  write(SENTENCES_KEY, listGuestSentences().filter(s => s.id !== id))
}

export function isGuestId(id?: string | null) {
  return typeof id === 'string' && id.startsWith('guest-')
}

export function clearAllGuestData() {
  localStorage.removeItem(NOTES_KEY)
  localStorage.removeItem(SENTENCES_KEY)
}



