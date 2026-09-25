import { useEffect, useRef, useState, useCallback } from 'react';

interface UseHorizontalScrollOptions {
  /** Multiplier for mouse wheel delta (default: 1) */
  wheelMultiplier?: number;
  /** Whether to enable mouse click-and-drag scrolling (default: true) */
  enableDrag?: boolean;
}

export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseHorizontalScrollOptions = {}
) {
  const { wheelMultiplier = 1, enableDrag = true } = options;
  const scrollRef = useRef<T | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Check scroll boundary limits
  const updateScrollBounds = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  // Programmatic scroll helpers
  const scrollByLeft = useCallback((amount = 220) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: -amount, behavior: 'smooth' });
  }, []);

  const scrollByRight = useCallback((amount = 220) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollBounds();

    // 1. Wheel listener: translate vertical wheel (deltaY) into horizontal scroll (scrollLeft)
    const onWheel = (e: WheelEvent) => {
      // If user is doing native horizontal trackpad scroll or tilt wheel, let native handle it
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return;
      }

      // If content fits within container, do nothing
      if (el.scrollWidth <= el.clientWidth) {
        return;
      }

      const canLeft = el.scrollLeft > 0;
      const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;

      // Only intercept if we can actually scroll horizontally in the intended direction
      if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * wheelMultiplier;
        updateScrollBounds();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', updateScrollBounds, { passive: true });

    // 2. Drag-to-scroll support with mouse
    let isMouseDown = false;
    let startX = 0;
    let initialScrollLeft = 0;
    let hasDragged = false;

    const onMouseDown = (e: MouseEvent) => {
      if (!enableDrag) return;
      // Only primary mouse button (left-click)
      if (e.button !== 0) return;

      isMouseDown = true;
      hasDragged = false;
      startX = e.pageX - el.offsetLeft;
      initialScrollLeft = el.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const currentX = e.pageX - el.offsetLeft;
      const walk = (currentX - startX) * 1.25;

      if (Math.abs(walk) > 5) {
        hasDragged = true;
        setIsDragging(true);
        el.scrollLeft = initialScrollLeft - walk;
        updateScrollBounds();
      }
    };

    const onMouseUp = () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      // Delay resetting isDragging slightly so child onClick handlers can see the state
      setTimeout(() => {
        setIsDragging(false);
      }, 50);
    };

    // Intercept click on children if dragging occurred
    const onClickCapture = (e: MouseEvent) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
      }
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('click', onClickCapture, true);

    // 3. ResizeObserver to keep scroll bounds updated when window or content resizes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateScrollBounds();
      });
      ro.observe(el);
      Array.from(el.children).forEach((child) => ro?.observe(child));
    }

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', updateScrollBounds);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('click', onClickCapture, true);
      if (ro) ro.disconnect();
    };
  }, [wheelMultiplier, enableDrag, updateScrollBounds]);

  return {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    scrollByLeft,
    scrollByRight,
    isDragging,
  };
}
