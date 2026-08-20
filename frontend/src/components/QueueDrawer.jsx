/**
 * QueueDrawer — slide-in right panel showing manual queue & infinite radio suggestions.
 * Click to jump; drag-to-reorder via @dnd-kit; quick-add recommendations.
 */
import { X, GripVertical, ListMusic, Trash2, Radio, Plus, Play, Sparkles, Loader2 } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatTime } from "../lib/formatTime";

function SortableTrack({ track, onPlay, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.06] transition-colors"
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="shrink-0 cursor-grab text-white/20 hover:text-white/50">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Thumbnail */}
      {track.thumbnail ? (
        <img src={track.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-white/5 shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(track)}>
        <p className="text-sm text-white truncate font-medium group-hover:text-accent transition-colors">{track.title}</p>
        <p className="text-xs text-white/40 truncate">{track.artist}</p>
      </div>

      <span className="text-xs text-white/25 tabular-nums shrink-0">
        {track.durationStr || formatTime(track.duration)}
      </span>

      {/* Remove */}
      <button
        onClick={() => onRemove(track.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 p-1"
        aria-label="Remove from queue"
        title="Remove from queue"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SuggestionRow({ track, onPlay, onAdd }) {
  return (
    <div className="group flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.06] transition-colors">
      {/* Thumbnail with quick play on hover */}
      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 cursor-pointer" onClick={() => onPlay(track)}>
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="w-3.5 h-3.5 text-accent fill-accent" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(track)}>
        <p className="text-sm text-white truncate font-medium group-hover:text-accent transition-colors">
          {track.title}
        </p>
        <p className="text-xs text-white/40 truncate">{track.artist}</p>
      </div>

      <span className="text-xs text-white/25 tabular-nums shrink-0">
        {track.durationStr || formatTime(track.duration)}
      </span>

      {/* Add to manual queue */}
      <button
        onClick={() => onAdd(track)}
        className="p-1.5 rounded-lg text-white/30 hover:text-accent hover:bg-white/5 transition-all"
        title="Add to manual queue"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function QueueDrawer() {
  const {
    isQueueOpen,
    toggleQueue,
    queue,
    currentTrack,
    playTrack,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isAutoplay,
    toggleAutoplay,
    autoplayQueue,
    autoplayLoading,
    addToQueue,
  } = usePlayerStore();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = queue.findIndex((t) => t.id === active.id);
    const newIdx = queue.findIndex((t) => t.id === over.id);
    reorderQueue(arrayMove(queue, oldIdx, newIdx));
  };

  return (
    <>
      {/* Backdrop (mobile) */}
      {isQueueOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={toggleQueue} />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 bottom-[100px] z-40 w-full sm:w-88 md:w-96
          glass-strong border-l border-white/[0.06]
          flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isQueueOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Queue & Radio</h2>
            {queue.length > 0 && (
              <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
                {queue.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-white/30 hover:text-red-400 transition-colors p-1"
                title="Clear manual queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleQueue} className="text-white/30 hover:text-white transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Autoplay status bar */}
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${isAutoplay ? "text-accent animate-pulse" : "text-white/30"}`} />
            <span className="text-xs font-medium text-white/80">Infinite Autoplay</span>
          </div>
          <button
            onClick={toggleAutoplay}
            className={`
              text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5
              ${isAutoplay 
                ? "bg-accent/20 text-accent border border-accent/40 shadow-[0_0_12px_rgba(163,230,53,0.3)]" 
                : "bg-white/5 text-white/40 border border-white/10 hover:text-white/60"}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAutoplay ? "bg-accent" : "bg-white/30"}`} />
            {isAutoplay ? "ENABLED" : "OFF"}
          </button>
        </div>

        {/* Currently playing */}
        {currentTrack && (
          <div className="px-3 py-3 border-b border-white/[0.04]">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-3 mb-1">Now Playing</p>
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-accent/10 ring-1 ring-accent/20">
              {currentTrack.thumbnail && (
                <img src={currentTrack.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-accent font-medium truncate">{currentTrack.title}</p>
                <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable list: Manual queue + Autoplay radio */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {/* Manual Queue Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">User Queue</p>
              {queue.length > 0 && (
                <span className="text-[10px] text-white/30">{queue.length} track{queue.length > 1 ? "s" : ""}</span>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03] text-center my-1">
                <p className="text-xs text-white/30">Manual queue is empty</p>
                <p className="text-[10px] text-white/20 mt-0.5">Songs you add from search will appear here first</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {queue.map((track) => (
                    <SortableTrack
                      key={track.id}
                      track={track}
                      onPlay={(t) => playTrack(t)}
                      onRemove={removeFromQueue}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Autoplay Radio Recommendations Section */}
          {isAutoplay && (
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between px-3 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-accent" />
                  <p className="text-[10px] uppercase tracking-widest text-accent font-semibold">Autoplay Station</p>
                </div>
                {autoplayLoading && (
                  <div className="flex items-center gap-1 text-[10px] text-white/30">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    <span>Tuning...</span>
                  </div>
                )}
              </div>

              {autoplayQueue.length > 0 ? (
                <div className="space-y-0.5">
                  {autoplayQueue.slice(0, 15).map((track) => (
                    <SuggestionRow
                      key={track.id}
                      track={track}
                      onPlay={(t) => playTrack(t)}
                      onAdd={(t) => addToQueue(t)}
                    />
                  ))}
                </div>
              ) : autoplayLoading ? (
                <div className="space-y-2 px-2 py-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2 animate-pulse">
                      <div className="w-9 h-9 rounded-lg bg-white/5" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-white/10 rounded w-3/4" />
                        <div className="h-2 bg-white/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25 px-3 py-2">No radio recommendations available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

