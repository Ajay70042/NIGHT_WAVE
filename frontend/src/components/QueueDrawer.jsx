/**
 * QueueDrawer — slide-in right panel showing upcoming queue.
 * Click to jump; drag-to-reorder via @dnd-kit.
 */
import { X, GripVertical, ListMusic, Trash2 } from "lucide-react";
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
        <p className="text-sm text-white truncate font-medium">{track.title}</p>
        <p className="text-xs text-white/40 truncate">{track.artist}</p>
      </div>

      <span className="text-xs text-white/25 tabular-nums shrink-0">
        {track.durationStr || formatTime(track.duration)}
      </span>

      {/* Remove */}
      <button
        onClick={() => onRemove(track.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400"
        aria-label="Remove from queue"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function QueueDrawer() {
  const { isQueueOpen, toggleQueue, queue, currentTrack, playTrack, removeFromQueue, reorderQueue, clearQueue } =
    usePlayerStore();

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
          fixed top-0 right-0 bottom-[80px] z-40 w-80
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
            <h2 className="text-sm font-semibold text-white">Up Next</h2>
            <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
              {queue.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-white/30 hover:text-red-400 transition-colors"
                title="Clear queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleQueue} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
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

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 gap-3">
              <ListMusic className="w-10 h-10 opacity-30" />
              <p className="text-sm">Queue is empty</p>
              <p className="text-xs text-white/15">Search and add tracks above</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <p className="text-[10px] uppercase tracking-widest text-white/25 px-3 mb-1">Next Up</p>
                {queue.map((track) => (
                  <SortableTrack
                    key={track.id}
                    track={track}
                    onPlay={(t) => playTrack(t, false)}
                    onRemove={removeFromQueue}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </>
  );
}
