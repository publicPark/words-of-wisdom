"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addGuestSentence } from "@/lib/guestStorage";

interface SentenceFormProps {
  noteId: string;
  isGuest: boolean;
  userId: string | null;
  noteOwnerId: string | null;
  onAdd: () => void;
}

export function SentenceForm({
  noteId,
  isGuest,
  userId,
  noteOwnerId,
  onAdd,
}: SentenceFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = isGuest || (userId && noteOwnerId && userId === noteOwnerId);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Please enter a sentence.");
      return;
    }
    setLoading(true);
    setError(null);

    if (isGuest) {
      addGuestSentence({
        note_id: noteId,
        title,
        description: description || null,
        mastery_level: 1,
      });
      setTitle("");
      setDescription("");
      setLoading(false);
      onAdd();
    } else {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const { error: insertError } = await supabase.from("sentences").insert({
        note_id: noteId,
        title,
        description: description || null,
        mastery_level: 1,
        created_by: uid,
      });
      setLoading(false);
      if (!insertError) {
        setTitle("");
        setDescription("");
        onAdd();
      } else {
        setError(insertError.message || "Failed to add sentence");
      }
    }
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm p-4 space-y-3">
      <label className="block text-sm font-medium text-gray-800">
        Sentence
      </label>
      <input
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
        placeholder="Sentence (title)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="block text-sm font-medium text-gray-800">
        Description
      </label>
      <textarea
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          className="ml-auto btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || !canEdit}
          aria-disabled={!canEdit}
          title={!canEdit ? "Only the owner can add sentences" : undefined}
        >
          Add
        </button>
      </div>
      {!isGuest && !userId && (
        <p className="text-xs text-gray-600">
          Sign in to add sentences to this note.
        </p>
      )}
      {!isGuest && userId && noteOwnerId && userId !== noteOwnerId && (
        <p className="text-xs text-gray-600">
          This is a public note. Only the owner can add sentences.
        </p>
      )}
    </section>
  );
}

