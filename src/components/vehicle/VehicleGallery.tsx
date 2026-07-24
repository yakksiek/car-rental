// core
import * as React from "react";

// others
import { cn } from "../../lib/utils";

// The vehicle detail image gallery (design screen 03's silhouette + dots, made
// real once photos exist). A native scroll-snap track gives free, accessible
// touch swiping on mobile/tablet; below it, dots indicate position. On desktop a
// clickable thumbnail strip + prev/next arrows drive the same track. Rendered only
// when a vehicle actually has photos (the parent falls back to the static
// silhouette otherwise), so a single photo simply shows with no nav chrome.

interface Props {
  photos: string[];
  alt: string;
}

export default function VehicleGallery({ photos, alt }: Props) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [current, setCurrent] = React.useState(0);

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const clamped = Math.max(0, Math.min(index, photos.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    setCurrent(Math.round(track.scrollLeft / track.clientWidth));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(current + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(current - 1);
    }
  }

  const multiple = photos.length > 1;

  return (
    // Key handling sits on the wrapper (the common ancestor of the track AND the
    // arrow/dot/thumbnail buttons) so Left/Right work whichever control has focus —
    // bubbled keydown from a focused button never reaches the track, which is its
    // sibling, not its parent.
    <div className="w-full" onKeyDown={multiple ? handleKeyDown : undefined}>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="group"
          aria-roledescription="karuzela"
          aria-label={alt}
          className="focus-visible:ring-foreground/25 flex snap-x snap-mandatory overflow-x-auto rounded-lg outline-none [scrollbar-width:none] focus-visible:ring-2 [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((src, i) => (
            <div key={src} className="flex w-full shrink-0 snap-center items-center justify-center">
              <img
                src={src}
                alt={`${alt} — zdjęcie ${String(i + 1)}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="h-[240px] w-full rounded-lg object-cover lg:h-[340px]"
              />
            </div>
          ))}
        </div>

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => {
                scrollToIndex(current - 1);
              }}
              disabled={current === 0}
              aria-label="Poprzednie zdjęcie"
              className="bg-card/90 text-foreground shadow-card absolute top-1/2 left-3 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full backdrop-blur transition disabled:pointer-events-none disabled:opacity-0 lg:flex"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                scrollToIndex(current + 1);
              }}
              disabled={current === photos.length - 1}
              aria-label="Następne zdjęcie"
              className="bg-card/90 text-foreground shadow-card absolute top-1/2 right-3 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full backdrop-blur transition disabled:pointer-events-none disabled:opacity-0 lg:flex"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Dots — mobile + tablet swipe indicator. */}
      {multiple && (
        <div className="mt-4 flex items-center justify-center gap-2 lg:hidden">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                scrollToIndex(i);
              }}
              aria-label={`Przejdź do zdjęcia ${String(i + 1)}`}
              aria-current={i === current}
              className={cn(
                "h-1.5 cursor-pointer rounded-full transition-all",
                i === current ? "bg-foreground w-4" : "w-1.5 bg-[var(--flota-hair)]",
              )}
            />
          ))}
        </div>
      )}

      {/* Thumbnails — desktop click-through. */}
      {multiple && (
        <div className="mt-4 hidden items-center justify-center gap-2.5 lg:flex">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                scrollToIndex(i);
              }}
              aria-label={`Przejdź do zdjęcia ${String(i + 1)}`}
              aria-current={i === current}
              className={cn(
                "h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition",
                i === current ? "border-foreground" : "border-transparent opacity-55 hover:opacity-100",
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
