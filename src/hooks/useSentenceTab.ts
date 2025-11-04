import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { listGuestSentences, type GuestSentence } from "@/lib/guestStorage";

export type Sentence = {
  id: string;
  title: string;
  description: string | null;
  mastery_level: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
};

export interface TabState {
  sentences: Sentence[];
  page: number;
  hasMore: boolean;
  loading: boolean;
}

const SENTENCES_PER_PAGE = 20;

export function useSentenceTab(
  tabType: "learning" | "mastered",
  noteId: string,
  isGuest: boolean
) {
  const [state, setState] = useState<TabState>({
    sentences: [],
    page: 0,
    hasMore: true,
    loading: false,
  });

  const loadTab = useCallback(
    async (page: number = 0, append: boolean = false) => {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        if (isGuest) {
          // Guest 모드: 로컬 스토리지에서 한 번에 로드하고 클라이언트에서 필터링/페이지네이션
          const allData = listGuestSentences(noteId) as GuestSentence[];
          const filtered = allData.filter((s) =>
            tabType === "learning"
              ? s.mastery_level === 1 || s.mastery_level === 2
              : s.mastery_level === 3
          );
          const sorted = filtered.sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
          );
          const start = page * SENTENCES_PER_PAGE;
          const end = start + SENTENCES_PER_PAGE;
          const pageData = sorted.slice(start, end) as Sentence[];

          setState((prev) => ({
            sentences: append ? [...prev.sentences, ...pageData] : pageData,
            page,
            hasMore: end < sorted.length,
            loading: false,
          }));
        } else {
          // 서버 모드: 서버에서 필터링 및 페이지네이션
          const supabase = createClient();
          const masteryLevels = tabType === "learning" ? [1, 2] : [3];

          const start = page * SENTENCES_PER_PAGE;
          const end = start + SENTENCES_PER_PAGE - 1;

          const query = supabase
            .from("sentences")
            .select(
              "id,title,description,mastery_level,created_at,updated_at",
              {
                count: "exact",
              }
            )
            .eq("note_id", noteId)
            .in("mastery_level", masteryLevels)
            .order("updated_at", { ascending: false })
            .range(start, end);

          const { data, error, count } = await query;

          if (error) {
            console.error("Error loading sentences:", error);
            setState((prev) => ({
              ...prev,
              loading: false,
              hasMore: false,
            }));
            return;
          }

          const sentences = (data as Sentence[]) || [];
          const totalCount = count || 0;
          const hasMore = end + 1 < totalCount;

          setState((prev) => ({
            sentences: append ? [...prev.sentences, ...sentences] : sentences,
            page,
            hasMore,
            loading: false,
          }));
        }
      } catch (error) {
        console.error("Error loading sentences:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          hasMore: false,
        }));
      }
    },
    [isGuest, noteId, tabType]
  );

  // ref를 사용하여 최신 상태 추적
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadMore = useCallback(async () => {
    const currentState = stateRef.current;
    if (!currentState.hasMore || currentState.loading) {
      return;
    }
    await loadTab(currentState.page + 1, true);
  }, [loadTab]);

  const reset = useCallback(() => {
    setState({
      sentences: [],
      page: 0,
      hasMore: true,
      loading: false,
    });
  }, []);

  // 안정적인 함수 참조를 위해 useMemo 사용
  // state는 별도로 반환하여 의존성 문제 방지
  return {
    state,
    loadTab,
    loadMore,
    reset,
  };
}

