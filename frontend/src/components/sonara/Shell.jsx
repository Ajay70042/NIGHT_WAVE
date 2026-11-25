import React, { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, Reorder } from "framer-motion";
import {
  Home, Compass, Library, History, Heart, Disc3, Mic2, ListMusic, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, X, GripVertical, PanelRightClose, Maximize2,
  PanelLeftClose, PanelLeftOpen, Radio, Minus, Square,
} from "lucide-react";
import { Link, useNavigate, useRouter, useRouterState } from "../../lib/router";
import { albumOf, fmt, trackById, usePlayer } from "../../lib/music";
import { SearchBar } from "./Search";
import { Cover, Visualizer } from "./ui";
import { FullPlayer, useFull } from "./FullPlayer";

function AppLogo({ className = "size-7" }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={`${className} shrink-0`} aria-hidden>
      <defs>
        <linearGradient id="mc-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#mc-grad)" fillOpacity="0.18" stroke="url(#mc-grad)" strokeWidth="1.5" />
      <path d="M9 24V13l5.5 6.5L20 13v11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.5" cy="22.5" r="2.5" fill="var(--primary)" />
      <path d="M28 22.5V12l-3.5 1.2" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/library", label: "Your Library", icon: Library, tab: "all" },
  { to: "/library", label: "Recently Played", icon: History, tab: "recent" },
  { to: "/library", label: "Favourite Tracks", icon: Heart, tab: "favourites" },
  { to: "/library", label: "Albums", icon: Disc3, tab: "albums" },
  { to: "/library", label: "Artists", icon: Mic2, tab: "artists" },
  { to: "/library", label: "Playlists", icon: ListMusic, tab: "playlists" },
];

function Sidebar() {
  const loc = useRouterState({ select: (s) => s.location });
  const tab = loc.search?.tab ?? "all";
  const isActive = (to, t) => loc.pathname === to && (!t || t === tab);

  const Item = ({ to, label, icon: Icon, t }) => (
    <Link
      to={to}
      search={t ? { tab: t } : {}}
      className="nav-item group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground"
    >
      {isActive(to, t) && (
        <motion.span
          layoutId="nav-active"
          className="nav-indicator absolute inset-0 rounded-lg"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <Icon
        className={`relative size-[17px] transition ${
          isActive(to, t) ? "text-primary" : "group-hover:translate-x-0.5"
        }`}
        strokeWidth={1.6}
      />
      <span className={`relative ${isActive(to, t) ? "text-foreground font-medium" : ""}`}>
        {label}
      </span>
    </Link>
  );

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 240, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="hidden md:block shrink-0 overflow-hidden"
    >
      <div className="flex h-full w-60 flex-col gap-6 border-r border-hairline px-4 py-6">
        <div className="flex items-center gap-2.5 px-3">
          <AppLogo className="size-7" />
          <div>
            <p className="font-display text-[15px] tracking-[0.22em]">MURGICHOR</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          <p className="label px-3 pb-2">Menu</p>
          {nav.slice(0, 2).map((n) => (
            <Item key={n.label} to={n.to} label={n.label} icon={n.icon} />
          ))}
          <p className="label px-3 pb-2 pt-5">Collection</p>
          {nav.slice(2).map((n) => (
            <Item key={n.label} to={n.to} label={n.label} icon={n.icon} t={n.tab} />
          ))}
        </nav>
      </div>
    </motion.aside>
  );
}

function QueuePanel() {
  const { queue, setQueue, removeFromQueue, currentId, play, toggleQueue, playing, loadRelatedMusic } = usePlayer();
  const cur = trackById(currentId);

  const panelRef = React.useRef(null);

  // Trigger loading related recommendations if queue is empty
  useEffect(() => {
    if (queue.length === 0 && cur?.id) {
      loadRelatedMusic(cur.id);
    }
  }, [queue.length, cur, loadRelatedMusic]);

  // Close when clicking/tapping outside the queue panel
  useEffect(() => {
    const onDown = (e) => {
      if (e.target.closest('[data-queue-toggle="true"]')) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        usePlayer.setState({ queueOpen: false });
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <motion.aside
      ref={panelRef}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity" }}
      className="elevated fixed bottom-24 right-5 z-30 w-80 max-h-[68vh] flex flex-col overflow-hidden rounded-2xl"
    >
      <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-primary animate-pulse" />
            <p className="font-display text-base">Up Next</p>
          </div>
          <button onClick={toggleQueue} aria-label="Close queue" className="icon-btn">
            <X className="size-4" />
          </button>
        </div>

        {cur && (
          <>
            <p className="label mb-2">Now playing</p>
            <div className="flex items-center gap-3 rounded-xl surface p-2 mb-4">
              <Cover src={albumOf(cur).cover} className="size-10 rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate text-primary font-medium">{cur.title}</p>
                <p className="text-xs text-muted-foreground truncate">{cur.artist}</p>
              </div>
              <Visualizer active={playing} />
            </div>
          </>
        )}

        <div className="flex items-center justify-between mb-2">
          <p className="label">Up Next · {queue.length}</p>
          {cur && !String(cur.id).startsWith("t") && (
            <button
              onClick={() => loadRelatedMusic(cur.id)}
              className="text-[10px] text-primary hover:underline cursor-pointer"
            >
              Refresh
            </button>
          )}
        </div>

        {queue.length > 0 ? (
          <Reorder.Group axis="y" values={queue} onReorder={setQueue} className="flex flex-col gap-0.5">
            {queue.map((id) => {
              const t = trackById(id);
              if (!t) return null;
              return (
                <Reorder.Item
                  key={id}
                  value={id}
                  className="group flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary/60 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="size-3 text-muted-foreground/40 shrink-0" />
                  <button
                    onClick={() => usePlayer.getState().playFromQueue(id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                  >
                    <Cover src={albumOf(t).cover} className="size-8 rounded shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => removeFromQueue(id)}
                    aria-label="Remove"
                    className="icon-btn opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <p>Fetching related songs from YouTube Music...</p>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

function PlayerBar() {
  const s = usePlayer();
  const navigate = useNavigate();
  const t = trackById(s.currentId);
  const a = albumOf(t);
  const dur = s.duration || t?.duration || 200;
  const pct = dur > 0 ? (s.time / dur) * 100 : 0;
  const fav = t ? s.favs.includes(t.id) : false;

  const openImmersive = () => {
    if (useFull.getState().lastMode === "lyrics") {
      navigate({ to: "/lyrics" });
    } else {
      useFull.getState().set(true);
    }
  };

  return (
    <footer className="player-bar relative z-10 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_minmax(0,1.4fr)_1fr] items-center gap-6 border-t border-hairline px-5 py-3.5">
      <div className="flex items-center gap-3.5 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={a.id || a.cover}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <button
              onClick={() => t && openImmersive()}
              aria-label="Open full screen or lyrics"
            >
              <Cover src={a.cover} className="size-14 rounded-lg shadow-art" />
            </button>
          </motion.div>
        </AnimatePresence>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{t ? t.title : "Murgichor"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {t ? `${t.artist} ${a.title ? `· ${a.title}` : ""}` : "Select a track to play"}
          </p>
        </div>
        {t && (
          <button
            onClick={() => s.toggleFav(t.id)}
            aria-label="Favourite"
            className="icon-btn"
          >
            <motion.span
              key={String(fav)}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="block"
            >
              <Heart className={`size-4 ${fav ? "fill-primary text-primary" : ""}`} />
            </motion.span>
          </button>
        )}
      </div>

      <div className="hidden md:flex flex-col items-center gap-2">
        <div className="flex items-center gap-5">
          <button
            onClick={s.toggleShuffle}
            aria-label="Shuffle"
            className={`icon-btn ${s.shuffle ? "text-primary" : ""}`}
          >
            <Shuffle className="size-4" />
          </button>
          <button onClick={s.prev} aria-label="Previous" className="icon-btn">
            <SkipBack className="size-[18px] fill-current" />
          </button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={s.toggle}
            aria-label={s.playing ? "Pause" : "Play"}
            className="play-btn size-10 rounded-full grid place-items-center"
          >
            {s.playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current translate-x-px" />
            )}
          </motion.button>
          <button onClick={s.next} aria-label="Next" className="icon-btn">
            <SkipForward className="size-[18px] fill-current" />
          </button>
          <button
            onClick={s.cycleRepeat}
            aria-label="Repeat"
            className={`icon-btn ${s.repeat !== "off" ? "text-primary" : ""}`}
          >
            {s.repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </button>
        </div>
        <div className="flex w-full items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
          <span className="w-9 text-right">{fmt(s.time)}</span>
          <input
            type="range"
            min={0}
            max={dur}
            value={s.time}
            onChange={(e) => s.seek(+e.target.value)}
            aria-label="Seek"
            className="range flex-1"
            style={{ "--p": `${pct}%` }}
          />
          <span className="w-9">-{fmt(Math.max(0, dur - s.time))}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={s.toggle}
          aria-label="Play/Pause"
          className="md:hidden play-btn size-10 rounded-full grid place-items-center"
        >
          {s.playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <button
          onClick={s.toggleQueue}
          data-queue-toggle="true"
          aria-label="Queue"
          title="Queue (L / Q)"
          aria-pressed={s.queueOpen}
          className={`icon-btn ${s.queueOpen ? "text-primary" : ""}`}
        >
          <ListMusic className="size-4" />
        </button>
        <button
          onClick={openImmersive}
          aria-label="Full screen"
          title="Full screen / Lyrics (F)"
          className="icon-btn"
        >
          <Maximize2 className="size-4" />
        </button>
        <button
          onClick={s.toggleMute}
          aria-label="Mute"
          className="icon-btn hidden md:block"
        >
          {s.muted || !s.volume ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={s.muted ? 0 : s.volume}
          onChange={(e) => s.setVolume(+e.target.value)}
          aria-label="Volume"
          className="range w-24 hidden md:block"
          style={{ "--p": `${(s.muted ? 0 : s.volume) * 100}%` }}
        />
      </div>
      <div className="md:hidden absolute top-0 inset-x-0 h-0.5 bg-secondary">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </footer>
  );
}

function Clock() {
  const playing = usePlayer((s) => s.playing);
  const [now, setNow] = useState(null);

  useEffect(() => {
    const show = () => {
      const d = new Date();
      setNow(
        `${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${d.toLocaleDateString([], { weekday: "short" })}`
      );
    };
    show();
    const i = setInterval(show, 20000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`size-1.5 rounded-full bg-primary ${playing ? "animate-pulse" : "opacity-40"}`}
        aria-hidden
      />
      <span className={`text-[11px] tabular-nums text-muted-foreground ${now ? "" : "opacity-0"}`}>
        {now ?? "00:00 · Mon"}
      </span>
    </div>
  );
}

function TopBar({ backHref, onProfile }) {
  const open = usePlayer((s) => s.sidebarOpen);
  const toggle = usePlayer((s) => s.toggleSidebar);
  const user = usePlayer((s) => s.userProfile);
  const navigate = useNavigate();

  const tauriInvoke = (cmd) => {
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    if (invoke) invoke(cmd).catch(() => {});
  };

  const handleDragStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".app-no-drag, button, input, a, textarea, select")) return;
    tauriInvoke("window_start_dragging");
  };

  const handleDoubleClick = (e) => {
    if (e.target.closest(".app-no-drag, button, input, a, textarea, select")) return;
    tauriInvoke("window_toggle_maximize");
  };

  const profileAvatar = user.connected && user.avatar ? (
    <img
      src={user.avatar}
      alt={user.name || "Profile"}
      className="size-8 rounded-full object-cover ring-1 ring-hairline"
    />
  ) : (
    <div className="size-8 rounded-full bg-secondary flex items-center justify-center ring-1 ring-hairline text-xs font-medium text-muted-foreground">
      {user.connected ? (user.name?.[0] || "Y") : "?"}
    </div>
  );

  return (
    <header
      onMouseDown={handleDragStart}
      onDoubleClick={handleDoubleClick}
      className="top-bar app-draggable relative z-20 flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-2.5 select-none"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3 app-no-drag">
        <button
          onClick={toggle}
          aria-label={open ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={open}
          title={`${open ? "Hide" : "Show"} sidebar (Ctrl/⌘ + B)`}
          className="icon-btn hidden md:block"
        >
          {open ? <PanelLeftClose className="size-[18px]" /> : <PanelLeftOpen className="size-[18px]" />}
        </button>
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="hidden shrink-0 items-center gap-2 md:flex"
            >
              <AppLogo className="size-6" />
              <p className="font-display text-[13px] tracking-[0.2em]">MURGICHOR</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="app-no-drag flex-1 max-w-2xl px-2">
        <SearchBar />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3 app-no-drag">
        <div className="hidden md:block">
          <Clock />
        </div>
        {onProfile ? (
          <button
            onClick={() => navigate({ to: backHref || "/" })}
            aria-label="Back to library"
            title="Back"
            className="relative shrink-0 rounded-full ring-2 ring-primary/60 transition hover:scale-105 cursor-pointer"
          >
            {profileAvatar}
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
          </button>
        ) : (
          <Link
            to="/settings"
            aria-label="Profile and settings"
            title={`${user.name || "Profile"} · Settings`}
            className="relative shrink-0 rounded-full transition hover:scale-105"
          >
            {profileAvatar}
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background ${
                user.connected ? "bg-primary" : "bg-muted-foreground"
              }`}
            />
          </Link>
        )}

        <div className="flex items-center gap-1 pl-2 ml-1 border-l border-hairline">
          <button
            onClick={() => tauriInvoke("window_minimize")}
            aria-label="Minimize"
            title="Minimize"
            className="icon-btn grid size-7 place-items-center rounded-md hover:bg-secondary/80 cursor-pointer"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => tauriInvoke("window_toggle_maximize")}
            aria-label="Maximize"
            title="Maximize / Restore"
            className="icon-btn grid size-7 place-items-center rounded-md hover:bg-secondary/80 cursor-pointer"
          >
            <Square className="size-3" />
          </button>
          <button
            onClick={() => tauriInvoke("window_close")}
            aria-label="Close"
            title="Close"
            className="icon-btn grid size-7 place-items-center rounded-md hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Shell({ children }) {
  const tick = usePlayer((s) => s.tick);
  const hue = usePlayer((s) => albumOf(trackById(s.currentId)).hue);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const sidebarOpen = usePlayer((s) => s.sidebarOpen);
  const syncWithBackend = usePlayer((s) => s.syncWithBackend);
  const loc = useRouterState({ select: (s) => s.location });
  const navigate = useNavigate();
  const router = useRouter();
  const path = loc.pathname;
  const immersive = path === "/lyrics";
  const pathRef = React.useRef(path);
  pathRef.current = path;
  const [backHref, setBackHref] = useState("/");

  useEffect(() => {
    if (path !== "/settings") setBackHref(path);
  }, [path]);

  // Sync backend data on mount & when window regains focus (throttled 30s)
  useEffect(() => {
    syncWithBackend();
    const t1 = setTimeout(syncWithBackend, 1200);
    const t2 = setTimeout(syncWithBackend, 3000);
    let lastFocusSync = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFocusSync > 30000) {
        lastFocusSync = Date.now();
        syncWithBackend();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncWithBackend]);


  useEffect(() => {
    try {
      if (localStorage.getItem("sonara:sidebar") === "0") {
        usePlayer.setState({ sidebarOpen: false });
      }
    } catch {}

    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        usePlayer.getState().toggleSidebar();
        return;
      }
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (isTyping || e.altKey) return;

      // Ctrl + Left/Right: Previous / Next track
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          usePlayer.getState().next();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          usePlayer.getState().prev();
        }
        return;
      }

      // Space: Play / Pause; ArrowLeft / ArrowRight: Seek -5s / +5s
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        usePlayer.getState().toggle();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const st = usePlayer.getState();
        const curT = trackById(st.currentId);
        const dur = st.duration || curT?.duration || 200;
        st.seek(Math.min(dur, (st.exactTime || st.time || 0) + 5));
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const st = usePlayer.getState();
        st.seek(Math.max(0, (st.exactTime || st.time || 0) - 5));
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "q" || key === "l") {
        if (pathRef.current !== "/lyrics" && !useFull.getState().open) {
          e.preventDefault();
          usePlayer.getState().toggleQueue();
        }
      } else if (key === "f") {
        e.preventDefault();
        if (pathRef.current === "/lyrics") {
          router.history.back();
        } else if (useFull.getState().open) {
          useFull.getState().set(false);
        } else if (useFull.getState().lastMode === "lyrics") {
          navigate({ to: "/lyrics" });
        } else {
          useFull.getState().set(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, router]);

  return (
    <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
    <div
      className="app-root relative isolate flex h-screen flex-col overflow-hidden bg-background text-foreground font-body"
      style={{ "--h": hue || 280 }}
    >
      <div className="ambient" />
      <div className="relative z-10 flex min-h-0 flex-1">
        <AnimatePresence>{sidebarOpen && !immersive && <Sidebar />}</AnimatePresence>
        <div className="flex min-w-0 flex-1 flex-col">
          {!immersive && <TopBar backHref={backHref} onProfile={path === "/settings"} />}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto" style={{ willChange: "scroll-position" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={path}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="group"
                data-layout={!sidebarOpen && !queueOpen ? "wide" : "default"}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <AnimatePresence>{queueOpen && !immersive && <QueuePanel />}</AnimatePresence>
      </div>
      {!immersive && <PlayerBar />}
      <FullPlayer />
    </div>
    </MotionConfig>
  );
}
