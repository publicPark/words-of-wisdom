import NoteDetailClient from './NoteDetailClient'

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NoteDetailClient noteId={id} />
}


