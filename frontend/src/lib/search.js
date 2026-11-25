import {
  albumOf,
  albums,
  fallbackCovers,
  playlists,
  tracks,
  trackById,
  tracksMap,
  playlistsMap,
  albumsMap,
  registerTracks,
  usePlayer,
} from "./music";
import { searchTracks } from "./api";

const norm = (s) => (s || "").toLowerCase().trim();

export function searchAll(q) {
  const needle = norm(q);
  if (!needle) return { tracks: [], albums: [], artists: [], playlists: [], total: 0 };
  const has = (s) => norm(s).includes(needle);

  // Search across all dynamically loaded tracks in tracksMap as well as initial tracks
  const allTracks = Array.from(tracksMap.values());
  const t = allTracks.filter((x) => has(x.title) || has(x.artist) || has(albumOf(x).title) || has(albumOf(x).kr));

  const allAlbums = Array.from(albumsMap.values());
  const al = allAlbums.filter((a) => has(a.title) || has(a.artist) || has(a.kr));

  const ar = [...new Set(allAlbums.filter((a) => has(a.artist)).map((a) => a.artist))];

  const allPlaylists = Array.from(playlistsMap.values());
  const pl = allPlaylists.filter((p) => has(p.name));

  return {
    tracks: t.slice(0, 8),
    albums: al.slice(0, 4),
    artists: ar.slice(0, 3),
    playlists: pl.slice(0, 3),
    total: t.length + al.length + ar.length + pl.length,
  };
}

const defaultCover = fallbackCovers[0];
const coverOf = (albumId) => albumsMap.get(albumId)?.cover ?? defaultCover;

export function flatten(r) {
  if (!r) return [];
  return [
    ...(r.tracks || []).map((t) => ({
      kind: "track",
      id: t.id,
      title: t.title,
      sub: `${t.artist} · ${albumOf(t).title}`,
      cover: albumOf(t).cover || defaultCover,
    })),
    ...(r.albums || []).map((a) => ({
      kind: "album",
      id: a.id,
      title: a.title,
      sub: `${a.artist} · ${a.year}`,
      cover: a.cover || defaultCover,
    })),
    ...(r.artists || []).map((a) => {
      const artistAlbum = Array.from(albumsMap.values()).find((al) => al.artist === a);
      return {
        kind: "artist",
        id: a,
        title: a,
        sub: "Artist",
        cover: artistAlbum?.cover || defaultCover,
      };
    }),
    ...(r.playlists || []).map((p) => {
      const first = (p.ids && p.ids[0]) || null;
      return {
        kind: "playlist",
        id: p.id,
        title: p.name,
        sub: `${(p.ids && p.ids.length) || p.count || 0} songs · Playlist`,
        cover: p.cover || (first ? albumOf(trackById(first)).cover : defaultCover),
      };
    }),
  ];
}

const start = (ids) => {
  const first = ids[0];
  if (!first) return;
  const { play, setQueue } = usePlayer.getState();
  play(first);
  setQueue(ids.slice(1));
};

export const playAlbum = (id) => {
  const allTracks = Array.from(tracksMap.values());
  start(allTracks.filter((t) => t.albumId === id).map((t) => t.id));
};

export const playArtist = (artist) => {
  const allTracks = Array.from(tracksMap.values());
  start(allTracks.filter((t) => t.artist === artist).map((t) => t.id));
};

export const playPlaylist = (id) => {
  usePlayer.getState().playPlaylist(id);
};

export function openHit(h) {
  if (!h) return;
  if (h.kind === "track") usePlayer.getState().play(h.id);
  else if (h.kind === "album") playAlbum(h.id);
  else if (h.kind === "artist") playArtist(h.id);
  else playPlaylist(h.id);
}

export const recentAlbums = () => [...albums].reverse().slice(0, 4);

export const moods = [
  { name: "Midnight" },
  { name: "Focus" },
  { name: "Rain" },
  { name: "Dreampop" },
];
