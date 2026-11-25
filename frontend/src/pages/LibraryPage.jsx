import React, { useMemo, useState, useEffect } from "react";
import { LayoutGrid, List, Search, ArrowLeft, Play, Shuffle, Plus } from "lucide-react";
import { Link, useRouterState } from "../lib/router";
import {
  albumOf,
  fallbackCovers,
  trackById,
  usePlayer,
  registerTracks,
} from "../lib/music";
import { AlbumCard, Cover, TrackRow } from "../components/sonara/ui";
import { fetchPlaylistTracks } from "../lib/api";

const tabs = ["all", "recent", "favourites", "albums", "artists", "playlists"];
const labels = {
  all: "All songs",
  recent: "Recently played",
  favourites: "Favourites",
  albums: "Albums",
  artists: "Artists",
  playlists: "Playlists",
};

export function LibraryPage() {
  const loc = useRouterState({ select: (s) => s.location });
  const tab = loc.search?.tab ?? "all";
  const playlistIdFromUrl = loc.search?.id;

  const [view, setView] = useState("list");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("added");

  // Playlist inspection state
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || creatingPlaylist) return;
    setCreatingPlaylist(true);
    try {
      await usePlayer.getState().createPlaylist(newPlaylistName.trim());
      setNewPlaylistName("");
    } catch (err) {
      console.error("Create playlist failed:", err);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const {
    favs,
    play,
    setQueue,
    likedTracks,
    userPlaylists,
    historyTracks,
    loadRelatedMusic,
  } = usePlayer();

  // Reset selected playlist when switching tabs, unless opening a specific playlist via URL
  useEffect(() => {
    if (!playlistIdFromUrl) {
      setSelectedPlaylist(null);
    }
  }, [tab, playlistIdFromUrl]);

  // Handle auto-opening a playlist passed via URL
  useEffect(() => {
    if (playlistIdFromUrl && userPlaylists.length > 0) {
      const target = userPlaylists.find((p) => p.id === playlistIdFromUrl);
      if (target) {
        openPlaylistDetail(target);
      }
    }
  }, [playlistIdFromUrl, userPlaylists]);

  // Handle clicking on a playlist to load its songs
  const openPlaylistDetail = async (p) => {
    setSelectedPlaylist(p);
    setLoadingPlaylist(true);
    try {
      const data = await fetchPlaylistTracks(p.id);
      if (data && Array.isArray(data.tracks)) {
        const reg = registerTracks(data.tracks);
        setPlaylistTracks(reg);
      } else {
        setPlaylistTracks([]);
      }
    } catch (err) {
      console.error("Failed to load playlist tracks:", err);
      setPlaylistTracks([]);
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const playEntirePlaylist = (shuffle = false) => {
    if (!playlistTracks.length) return;
    let list = [...playlistTracks];
    if (shuffle) {
      list = list.sort(() => Math.random() - 0.5);
    }
    play(list[0].id);
    setQueue(list.slice(1).map((t) => t.id));
    loadRelatedMusic(list[0].id);
  };

  // Combine user's real YouTube Music data
  const combinedUserTracks = useMemo(() => {
    const map = new Map();
    [...likedTracks, ...historyTracks].forEach((t) => {
      if (t && t.id && !map.has(t.id)) map.set(t.id, t);
    });
    return Array.from(map.values());
  }, [likedTracks, historyTracks]);

  // Determine which tracks to show for the current tab
  const list = useMemo(() => {
    let sourceTracks = combinedUserTracks;

    if (tab === "favourites") {
      sourceTracks = likedTracks;
    } else if (tab === "recent") {
      sourceTracks = historyTracks;
    }

    let filtered = sourceTracks.filter((t) =>
      `${t.title} ${t.artist}`.toLowerCase().includes(q.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sort === "added") return (b.added || 0) - (a.added || 0);
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      if (sort === "artist") return (a.artist || "").localeCompare(b.artist || "");
      return 0;
    });
  }, [tab, likedTracks, historyTracks, combinedUserTracks, q, sort]);

  const allPlaylistsList = userPlaylists;

  // Extract real artists from user's music library
  const libraryArtists = useMemo(() => {
    const map = new Map();
    combinedUserTracks.forEach((t) => {
      if (t.artist && !map.has(t.artist)) {
        map.set(t.artist, t);
      }
    });
    return Array.from(map.entries()).map(([artist, sampleTrack]) => ({
      artist,
      cover: sampleTrack.cover,
      trackId: sampleTrack.id,
    }));
  }, [combinedUserTracks]);

  // Extract real albums from user's music library
  const libraryAlbums = useMemo(() => {
    const map = new Map();
    combinedUserTracks.forEach((t) => {
      const alb = albumOf(t);
      if (alb && alb.title && !map.has(alb.title)) {
        map.set(alb.title, { ...alb, firstTrackId: t.id });
      }
    });
    return Array.from(map.values());
  }, [combinedUserTracks]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10 transition-[max-width,padding] duration-500 group-data-[layout=wide]:max-w-none group-data-[layout=wide]:px-10">
      <p className="label">Library</p>

      {/* Playlist Detail View */}
      {selectedPlaylist ? (
        <div className="mt-4">
          <button
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6 cursor-pointer"
          >
            <ArrowLeft className="size-4" /> Back to Playlists
          </button>

          <div className="surface rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 mb-8">
            <Cover
              src={selectedPlaylist.cover || fallbackCovers[0]}
              className="size-36 sm:size-44 rounded-xl shadow-art"
            />
            <div className="flex-1 text-center sm:text-left min-w-0">
              <span className="label">YouTube Music Playlist</span>
              <h1 className="font-display text-3xl sm:text-4xl mt-2 truncate">
                {selectedPlaylist.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {playlistTracks.length > 0 ? `${playlistTracks.length} songs` : `${selectedPlaylist.count || 0} songs`}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <button
                  onClick={() => playEntirePlaylist(false)}
                  disabled={playlistTracks.length === 0}
                  className="btn-primary cursor-pointer"
                >
                  <Play className="size-4 fill-current" /> Play All
                </button>
                <button
                  onClick={() => playEntirePlaylist(true)}
                  disabled={playlistTracks.length === 0}
                  className="btn-ghost cursor-pointer"
                >
                  <Shuffle className="size-4" /> Shuffle
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {loadingPlaylist ? (
              <div className="py-12 text-center text-muted-foreground">Loading songs from YouTube Music...</div>
            ) : playlistTracks.length > 0 ? (
              <div className="flex flex-col">
                {playlistTracks.map((t, i) => (
                  <TrackRow key={t.id + i} t={t} i={i} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No songs found in this playlist.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Regular Library Views */
        <>
          <h1 className="font-display text-4xl mt-2">{labels[tab]}</h1>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <Link
                key={t}
                to="/library"
                search={{ tab: t }}
                className={`chip ${tab === t ? "chip-active" : ""}`}
              >
                {labels[t]}
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="field flex flex-1 min-w-52 items-center gap-2 rounded-lg px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your library"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="field rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
            >
              <option value="added" className="bg-card">Recently added</option>
              <option value="title" className="bg-card">Title</option>
              <option value="artist" className="bg-card">Artist</option>
            </select>
            <div className="field flex rounded-lg p-1">
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                className={`seg cursor-pointer ${view === "list" ? "seg-active" : ""}`}
              >
                <List className="size-4" />
              </button>
              <button
                onClick={() => setView("grid")}
                aria-label="Grid view"
                className={`seg cursor-pointer ${view === "grid" ? "seg-active" : ""}`}
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-8">
            {tab === "albums" ? (
              libraryAlbums.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-5 group-data-[layout=wide]:xl:grid-cols-7">
                  {libraryAlbums.map((a, i) => (
                    <AlbumCard
                      key={a.id || i}
                      album={a}
                      i={i}
                      onPlay={() => a.firstTrackId && play(a.firstTrackId)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8">No albums found in your library.</p>
              )
            ) : tab === "artists" ? (
              libraryArtists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6 group-data-[layout=wide]:xl:grid-cols-7">
                  {libraryArtists.map((ar) => (
                    <button
                      key={ar.artist}
                      onClick={() => play(ar.trackId)}
                      className="group text-center cursor-pointer"
                    >
                      <Cover
                        src={ar.cover}
                        className="mx-auto aspect-square w-full rounded-full shadow-art transition group-hover:scale-[1.03]"
                      />
                      <p className="mt-3 text-sm font-medium truncate">{ar.artist}</p>
                      <p className="text-xs text-muted-foreground">Artist</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8">No artists found in your library.</p>
              )
            ) : tab === "playlists" ? (
              <div>
                <form onSubmit={handleCreatePlaylist} className="mb-6 flex items-center gap-2 max-w-md">
                  <input
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="New YouTube Music playlist name..."
                    className="field flex-1 rounded-full px-4 py-2 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={creatingPlaylist || !newPlaylistName.trim()}
                    className="btn-primary !px-4 !py-2 !text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    {creatingPlaylist ? "Creating..." : "Create"}
                  </button>
                </form>
                {allPlaylistsList.length > 0 ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {allPlaylistsList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openPlaylistDetail(p)}
                      className="surface group flex items-center gap-4 rounded-xl p-3 text-left transition hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="size-20 overflow-hidden rounded-lg shrink-0 bg-card">
                        <Cover
                          src={p.cover}
                          className="size-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.count || p.ids?.length || 0} songs · YouTube Music
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No playlists found. Connect your YouTube Music account or create one above.</p>
                )}
              </div>
            ) : view === "list" ? (
              <div>
                {list.map((t, i) => (
                  <TrackRow key={t.id + i} t={t} i={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-5 group-data-[layout=wide]:xl:grid-cols-7">
                {list.map((t, i) => (
                  <AlbumCard
                    key={t.id + i}
                    album={{ ...albumOf(t), title: t.title }}
                    i={i}
                    onPlay={() => play(t.id)}
                  />
                ))}
              </div>
            )}
            {list.length === 0 && !["albums", "artists", "playlists"].includes(tab) && (
              <p className="text-sm text-muted-foreground py-8">No songs match.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
