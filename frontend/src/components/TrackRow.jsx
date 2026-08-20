/**
 * TrackRow — a horizontal scrollable row of BrowseCards.
 * Shows a section title, optional emoji, and a → arrow.
 * Loading state shows skeleton placeholder cards.
 */
import BrowseCard from "./BrowseCard";

function SkeletonCard() {
  return (
    <div className="w-36 sm:w-40 shrink-0 flex flex-col gap-2.5 animate-pulse">
      <div className="w-full aspect-square rounded-xl bg-white/[0.06]" />
      <div className="px-0.5 flex flex-col gap-1.5">
        <div className="h-3 w-4/5 rounded bg-white/[0.07]" />
        <div className="h-2.5 w-3/5 rounded bg-white/[0.05]" />
      </div>
    </div>
  );
}

export default function TrackRow({ title, emoji, tracks, loading, error }) {
  // Don't render a row that has nothing to show and isn't loading
  if (!loading && !tracks?.length && !error) return null;

  return (
    <section className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 sm:px-8">
        <h2 className="text-sm font-semibold text-white/80">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {title}
        </h2>
        {tracks?.length > 0 && (
          <span className="text-[11px] text-white/30">{tracks.length} tracks</span>
        )}
      </div>

      {/* Scrollable strip */}
      <div
        className="flex gap-3 overflow-x-auto px-5 sm:px-8 pb-2"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {loading
          ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
          : error
          ? (
            <p className="text-[12px] text-white/25 py-4">
              Couldn't load — start the backend to see suggestions.
            </p>
          )
          : tracks.map((track) => (
              <BrowseCard key={track.id} track={track} />
            ))
        }
      </div>
    </section>
  );
}
