"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  isStorageAvailable,
  listGuestNotes,
  updateGuestNote,
  listGuestSentences,
  type GuestSentence,
} from "@/lib/guestStorage";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useSentenceTab, type Sentence } from "@/hooks/useSentenceTab";
import { SentenceItem } from "@/components/SentenceItem";
import { SentenceForm } from "@/components/SentenceForm";

interface NoteDetailClientProps {
  noteId: string;
}

export default function NoteDetailClient({ noteId }: NoteDetailClientProps) {
  const { userId } = useAuth();
  const isGuestById = typeof noteId === "string" && noteId.startsWith("guest-");
  const isGuestLocal =
    isStorageAvailable() && !!listGuestNotes().find((n) => n.id === noteId);
  const isGuest = isGuestById || isGuestLocal;

  const [tab, setTab] = useState<"learning" | "mastered">("learning");
  const [loadingSentences, setLoadingSentences] = useState(true);
  const [noteOwnerId, setNoteOwnerId] = useState<string | null>(null);
  const [noteIsPublic, setNoteIsPublic] = useState<boolean>(false);
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [editingNoteTitle, setEditingNoteTitle] = useState(false);
  const [editNoteTitleValue, setEditNoteTitleValue] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [learningCount, setLearningCount] = useState<number>(0);
  const [masteredCount, setMasteredCount] = useState<number>(0);

  // 탭별 상태 관리
  const learningTab = useSentenceTab("learning", noteId, isGuest);
  const masteredTab = useSentenceTab("mastered", noteId, isGuest);

  // loadTab 함수를 안정적으로 참조
  const learningLoadTab = learningTab.loadTab;
  const masteredLoadTab = masteredTab.loadTab;
  const learningLoadMore = learningTab.loadMore;
  const masteredLoadMore = masteredTab.loadMore;

  const currentTab = tab === "learning" ? learningTab : masteredTab;
  const currentState = currentTab.state;

  // 초기 로드 상태 추적
  const hasInitiallyLoaded = useRef(false);

  // 초기 로드 및 리로드 함수를 ref로 관리하여 안정화
  const loadInitialRef = useRef<(() => Promise<void>) | null>(null);
  const reloadRef = useRef<(() => Promise<void>) | null>(null);
  const learningLoadTabRef = useRef(learningTab.loadTab);
  const masteredLoadTabRef = useRef(masteredTab.loadTab);

  // loadTab 함수 참조 업데이트
  useEffect(() => {
    learningLoadTabRef.current = learningTab.loadTab;
    masteredLoadTabRef.current = masteredTab.loadTab;
  }, [learningTab.loadTab, masteredTab.loadTab]);

  // 초기 로드 및 리로드 함수 설정 (한 번만 설정)
  useEffect(() => {
    loadInitialRef.current = async () => {
      setLoadingSentences(true);
      try {
        await Promise.all([
          learningLoadTabRef.current(0, false),
          masteredLoadTabRef.current(0, false),
        ]);
        await loadCounts();
      } finally {
        setLoadingSentences(false);
      }
    };
    reloadRef.current = async () => {
      setLoadingSentences(true);
      try {
        await Promise.all([
          learningLoadTabRef.current(0, false),
          masteredLoadTabRef.current(0, false),
        ]);
        await loadCounts();
      } finally {
        setLoadingSentences(false);
      }
    };
  }, []);

  // 노트 정보 로드 및 초기 문장 로드
  useEffect(() => {
    hasInitiallyLoaded.current = false;

    if (!isGuest) {
      const supabase = createClient();
      supabase
        .from("notes")
        .select("title,created_by,is_public")
        .eq("id", noteId)
        .maybeSingle()
        .then((res) => {
          if (!res.error && res.data) {
            setNoteTitle(res.data.title ?? "");
            setNoteOwnerId(res.data.created_by ?? null);
            setNoteIsPublic(!!res.data.is_public);
          }
        });
    } else {
      const guestNote = listGuestNotes().find((n) => n.id === noteId);
      if (guestNote) {
        setNoteTitle(guestNote.title);
      }
      setNoteOwnerId(null);
      setNoteIsPublic(false);
    }

    // 초기 로드 함수가 준비된 후에만 실행
    const timeoutId = setTimeout(() => {
      if (loadInitialRef.current) {
        loadInitialRef.current();
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [noteId, isGuest]);

  const loadInitial = useCallback(async () => {
    if (loadInitialRef.current) {
      await loadInitialRef.current();
    }
  }, []);

  const reload = useCallback(async () => {
    if (reloadRef.current) {
      await reloadRef.current();
    }
  }, []);

  // 문장 수 집계 로드 (게스트/서버 모두 지원)
  const loadCounts = useCallback(async () => {
    try {
      if (isGuest) {
        const all = listGuestSentences(noteId) as GuestSentence[];
        const learn = all.filter(
          (s: GuestSentence) => s.mastery_level === 1 || s.mastery_level === 2
        ).length;
        const mast = all.filter(
          (s: GuestSentence) => s.mastery_level === 3
        ).length;
        setLearningCount(learn);
        setMasteredCount(mast);
      } else {
        const supabase = createClient();
        const [learnRes, mastRes] = await Promise.all([
          supabase
            .from("sentences")
            .select("*", { count: "exact", head: true })
            .eq("note_id", noteId)
            .in("mastery_level", [1, 2]),
          supabase
            .from("sentences")
            .select("*", { count: "exact", head: true })
            .eq("note_id", noteId)
            .eq("mastery_level", 3),
        ]);
        setLearningCount(learnRes.count || 0);
        setMasteredCount(mastRes.count || 0);
      }
    } catch (e) {
      // 집계 실패 시 0으로 유지
    }
  }, [isGuest, noteId]);

  // 노트 정보 로드 및 초기 문장 로드
  useEffect(() => {
    hasInitiallyLoaded.current = false;

    if (!isGuest) {
      const supabase = createClient();
      supabase
        .from("notes")
        .select("title,created_by,is_public")
        .eq("id", noteId)
        .maybeSingle()
        .then((res) => {
          if (!res.error && res.data) {
            setNoteTitle(res.data.title ?? "");
            setNoteOwnerId(res.data.created_by ?? null);
            setNoteIsPublic(!!res.data.is_public);
          }
        });
    } else {
      const guestNote = listGuestNotes().find((n) => n.id === noteId);
      if (guestNote) {
        setNoteTitle(guestNote.title);
      }
      setNoteOwnerId(null);
      setNoteIsPublic(false);
    }

    // 초기 로드 실행
    if (loadInitialRef.current) {
      loadInitialRef.current();
    }
  }, [noteId, isGuest]);

  // 초기 로드 완료 감지
  useEffect(() => {
    if (!hasInitiallyLoaded.current && !loadingSentences) {
      hasInitiallyLoaded.current = true;
    }
  }, [loadingSentences]);

  // 노트 제목 편집
  const startEditNoteTitle = () => {
    setEditingNoteTitle(true);
    setEditNoteTitleValue(noteTitle);
  };

  const cancelEditNoteTitle = () => {
    setEditingNoteTitle(false);
    setEditNoteTitleValue("");
  };

  const saveNoteTitle = async () => {
    if (!editNoteTitleValue.trim()) {
      setLastError("Please enter a note title.");
      return;
    }

    setLoading(true);
    setLastError(null);

    try {
      if (isGuest) {
        updateGuestNote(noteId, { title: editNoteTitleValue.trim() });
        setNoteTitle(editNoteTitleValue.trim());
        cancelEditNoteTitle();
        setLoading(false);
      } else {
        if (!userId || !noteOwnerId || userId !== noteOwnerId) {
          setLastError("You can only edit your own notes.");
          setLoading(false);
          return;
        }

        const supabase = createClient();
        const { error } = await supabase
          .from("notes")
          .update({ title: editNoteTitleValue.trim() })
          .eq("id", noteId);

        if (error) {
          setLastError(error.message || "Failed to update note title");
        } else {
          setNoteTitle(editNoteTitleValue.trim());
          cancelEditNoteTitle();
        }
        setLoading(false);
      }
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Failed to update note title"
      );
      setLoading(false);
    }
  };

  const canEditNote =
    isGuest || (userId && noteOwnerId && userId === noteOwnerId);

  // JSON Export (guest only)
  const downloadJson = (filename: string, data: unknown) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setLastError(
        e instanceof Error ? e.message : "Failed to export sentences"
      );
    }
  };

  const handleExportSentences = useCallback(async () => {
    if (!isGuest) return;
    try {
      const all = listGuestSentences(noteId) as GuestSentence[];
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        title: noteTitle || "",
        sentences: all.map((s) => ({
          title: s.title,
          description: s.description ?? null,
          mastery_level: s.mastery_level,
        })),
      };
      const date = new Date().toISOString().slice(0, 10);
      const filename = `sentences-export-${date}.json`;
      downloadJson(filename, payload);
    } catch (e) {
      setLastError(
        e instanceof Error ? e.message : "Failed to export sentences"
      );
    }
  }, [isGuest, noteId, noteTitle]);

  // 무한 스크롤: 다음 페이지 로드 (ref를 사용하여 최신 상태 추적)
  const loadMoreRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    loadMoreRef.current = async () => {
      const state = currentState;
      const tabLoadMore =
        tab === "learning" ? learningTab.loadMore : masteredTab.loadMore;
      if (!state.hasMore || state.loading) {
        return;
      }
      await tabLoadMore();
    };
  }, [
    tab,
    currentState.hasMore,
    currentState.loading,
    learningTab.loadMore,
    masteredTab.loadMore,
  ]);

  const loadMore = useCallback(async () => {
    if (loadMoreRef.current) {
      await loadMoreRef.current();
    }
  }, []);

  // 무한 스크롤 enabled 옵션 계산
  const infiniteScrollEnabled = useMemo(() => {
    if (loadingSentences || currentState.loading) {
      return false;
    }
    if (!currentState.hasMore) {
      return false;
    }
    // 문장이 0개이고 페이지가 0이면 더 이상 로드할 것이 없으므로 비활성화
    if (currentState.sentences.length === 0 && currentState.page === 0) {
      return false;
    }
    return true;
  }, [
    currentState.hasMore,
    currentState.loading,
    currentState.sentences.length,
    currentState.page,
    loadingSentences,
  ]);

  // 무한 스크롤 훅
  const { ref: infiniteScrollRef } = useInfiniteScroll(loadMore, {
    enabled: infiniteScrollEnabled,
    threshold: 0.5,
    preventLoadWhileLoading: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        {editingNoteTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="flex-1 text-2xl font-semibold border border-neutral-700 rounded-md px-3 py-2 bg-neutral-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
              value={editNoteTitleValue}
              onChange={(e) => setEditNoteTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveNoteTitle();
                } else if (e.key === "Escape") {
                  cancelEditNoteTitle();
                }
              }}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={saveNoteTitle}
              disabled={loading}
            >
              Save
            </button>
            <button
              className="btn btn-secondary"
              onClick={cancelEditNoteTitle}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold">
                {noteTitle || "Sentences"}
              </h1>
            </div>
            {isGuest && (
              <button
                className="text-xs text-gray-400 hover:text-gray-200 hover:underline"
                onClick={handleExportSentences}
                aria-label="Export sentences as JSON"
              >
                Export (JSON)
              </button>
            )}
            {canEditNote && (
              <button className="btn btn-primary" onClick={startEditNoteTitle}>
                Edit Title
              </button>
            )}
          </>
        )}
      </div>

      <div className="inline-flex rounded-md border bg-white shadow-sm overflow-hidden">
        <button
          className={`px-4 py-2 text-sm font-medium border-r ${
            tab === "learning"
              ? "bg-gray-900 text-white"
              : "text-slate-200 hover:bg-neutral-800 hover:text-slate-100"
          }`}
          onClick={() => setTab("learning")}
        >
          <span className="sr-only">Learning (levels 1 and 2)</span>
          <div className="flex items-center gap-2" aria-hidden>
            <Image src="/lev1.png" alt="Level 1" width={20} height={20} />
            <Image src="/lev2.png" alt="Level 2" width={20} height={20} />
            <span className="ml-1 text-xs text-slate-300">{learningCount}</span>
          </div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "mastered"
              ? "bg-gray-900 text-white"
              : "text-slate-200 hover:bg-neutral-800 hover:text-slate-100"
          }`}
          onClick={() => setTab("mastered")}
        >
          <span className="sr-only">Mastered (level 3)</span>
          <div className="flex items-center" aria-hidden>
            <Image src="/lev3.png" alt="Level 3" width={22} height={22} />
            <span className="ml-1 text-xs text-slate-300">{masteredCount}</span>
          </div>
        </button>
      </div>

      {lastError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {lastError}
        </div>
      )}

      <SentenceForm
        noteId={noteId}
        isGuest={isGuest}
        userId={userId}
        noteOwnerId={noteOwnerId}
        onAdd={reload}
      />

      <section className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm">
        {loadingSentences ? (
          <div className="p-8 text-center text-gray-600">
            Loading sentences...
          </div>
        ) : (
          <ul className="divide-y">
            {currentState.sentences.map((s) => (
              <SentenceItem
                key={s.id}
                sentence={s}
                isGuest={isGuest}
                onUpdate={reload}
              />
            ))}
            {currentState.sentences.length === 0 && !currentState.loading && (
              <li className="p-8 text-center text-gray-600">No sentences</li>
            )}
            {/* 무한 스크롤 트리거 */}
            {currentState.hasMore && (
              <li ref={infiniteScrollRef} className="p-4">
                {currentState.loading && (
                  <div className="text-center text-gray-600">
                    Loading more...
                  </div>
                )}
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
