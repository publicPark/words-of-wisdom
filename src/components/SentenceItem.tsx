"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateGuestSentence, deleteGuestSentence } from "@/lib/guestStorage";
import { MasteryBadge } from "@/components/MasteryBadge";
import Image from "next/image";
import type { Sentence } from "@/hooks/useSentenceTab";

interface SentenceItemProps {
  sentence: Sentence;
  isGuest: boolean;
  onUpdate: () => void;
}

export function SentenceItem({
  sentence,
  isGuest,
  onUpdate,
}: SentenceItemProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const startEdit = () => {
    setEditingId(sentence.id);
    setEditTitle(sentence.title);
    setEditDesc(sentence.description ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDesc("");
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      return;
    }
    setLoading(true);
    if (isGuest) {
      updateGuestSentence(sentence.id, {
        title: editTitle,
        description: editDesc || null,
      });
      setLoading(false);
      cancelEdit();
      onUpdate();
    } else {
      const supabase = createClient();
      const { error } = await supabase
        .from("sentences")
        .update({ title: editTitle, description: editDesc || null })
        .eq("id", sentence.id);
      setLoading(false);
      if (!error) {
        cancelEdit();
        onUpdate();
      }
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this sentence? This action cannot be undone."
      )
    ) {
      return;
    }
    if (isGuest) {
      deleteGuestSentence(sentence.id);
    } else {
      const supabase = createClient();
      await supabase.from("sentences").delete().eq("id", sentence.id);
    }
    onUpdate();
  };

  const handleRefresh = async () => {
    if (isGuest) {
      updateGuestSentence(sentence.id, { mastery_level: 1 });
    } else {
      const supabase = createClient();
      await supabase
        .from("sentences")
        .update({ mastery_level: 1 })
        .eq("id", sentence.id);
    }
    onUpdate();
  };

  const handleLevelUp = async () => {
    const nextLevel =
      sentence.mastery_level < 3
        ? ((sentence.mastery_level + 1) as 1 | 2 | 3)
        : sentence.mastery_level;
    if (isGuest) {
      updateGuestSentence(sentence.id, { mastery_level: nextLevel });
    } else {
      const supabase = createClient();
      await supabase
        .from("sentences")
        .update({ mastery_level: nextLevel })
        .eq("id", sentence.id);
    }
    onUpdate();
  };

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingId === sentence.id ? (
            <div className="space-y-2">
              <input
                className="w-full border border-neutral-700 rounded-md px-3 py-2 bg-neutral-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <textarea
                className="w-full border border-neutral-700 rounded-md px-3 py-2 bg-neutral-800 text-slate-100 whitespace-pre-line focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="font-medium text-slate-100">{sentence.title}</div>
              {sentence.description && (
                <div className="text-sm text-slate-200 mt-1 whitespace-pre-line">
                  {sentence.description}
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">
                {new Date(sentence.created_at).toLocaleDateString("ko-KR")}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {editingId !== sentence.id && (
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-sm bg-white/10 backdrop-blur-sm text-white rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
                onClick={handleRefresh}
                disabled={loading || sentence.mastery_level === 1}
                title="Refresh (레벨 리셋)"
              >
                Refresh
              </button>
              <button
                className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 flex items-center justify-center transition-colors h-[34px]"
                onClick={handleLevelUp}
                disabled={loading || sentence.mastery_level === 3}
                title="물주기 (레벨 상승)"
              >
                <Image
                  src="/watering.png"
                  alt="물주기"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </button>
            </div>
          )}
          <MasteryBadge level={sentence.mastery_level} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        {editingId === sentence.id ? (
          <>
            <button
              className="btn btn-primary"
              onClick={saveEdit}
              disabled={loading}
            >
              Save
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-secondary" onClick={startEdit}>
            Edit
          </button>
        )}
        <button
          className="ml-auto text-red-400 hover:underline cursor-pointer"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
