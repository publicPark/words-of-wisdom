import { useEffect, useRef, useCallback } from "react";

export interface InfiniteScrollOptions {
  /**
   * 스크롤 감지 여부를 제어합니다.
   * false일 때는 자동 로드가 발생하지 않습니다.
   */
  enabled?: boolean;
  /**
   * 스크롤 감지 영역의 상단 여백 (threshold)을 설정합니다.
   * 0.0 ~ 1.0 사이의 값으로, 0.5는 요소의 50%가 보일 때 트리거됩니다.
   */
  threshold?: number;
  /**
   * 루트 요소를 지정합니다. 기본값은 viewport입니다.
   */
  root?: Element | null;
  /**
   * 루트 요소의 마진을 설정합니다.
   */
  rootMargin?: string;
  /**
   * 로딩 중일 때 추가 로드 방지 여부
   */
  preventLoadWhileLoading?: boolean;
}

/**
 * 무한 스크롤을 위한 재사용 가능한 훅
 * 
 * @param loadMore - 추가 데이터를 로드하는 함수. Promise를 반환해야 합니다.
 * @param options - InfiniteScrollOptions 설정
 * @returns ref - 이 ref를 마지막 요소에 연결하면 스크롤 감지가 활성화됩니다.
 * 
 * @example
 * ```tsx
 * const { ref, isLoading } = useInfiniteScroll(
 *   async () => {
 *     await fetchMoreData();
 *   },
 *   { enabled: hasMore, threshold: 0.5 }
 * );
 * 
 * return (
 *   <div>
 *     {items.map(item => <div key={item.id}>{item.name}</div>)}
 *     {hasMore && <div ref={ref}>Loading more...</div>}
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll(
  loadMore: () => Promise<void> | void,
  options: InfiniteScrollOptions = {}
) {
  const {
    enabled = true,
    threshold = 0.5,
    root = null,
    rootMargin = "0px",
    preventLoadWhileLoading = true,
  } = options;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const isLoadingRef = useRef(false);
  const enabledRef = useRef(enabled);

  // enabled 값 변경 시 즉시 반영
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Intersection Observer 설정
  useEffect(() => {
    const element = elementRef.current;
    
    // enabled가 false이거나 element가 없으면 observer 정리
    if (!enabledRef.current || !element) {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    // 기존 observer 정리
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // 새로운 observer 생성
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          enabledRef.current &&
          (!preventLoadWhileLoading || !isLoadingRef.current)
        ) {
          isLoadingRef.current = true;
          Promise.resolve(loadMore())
            .catch((error) => {
              console.error("Error loading more data:", error);
            })
            .finally(() => {
              isLoadingRef.current = false;
            });
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observerRef.current.observe(element);

    // cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [loadMore, root, rootMargin, threshold, preventLoadWhileLoading, enabled]);

  // ref 반환 - 컴포넌트에서 사용할 ref
  const setRef = useCallback(<T extends HTMLElement = HTMLElement>(
    node: T | null
  ) => {
    elementRef.current = node;
  }, []);

  return {
    ref: setRef as <T extends HTMLElement>(node: T | null) => void,
  };
}

