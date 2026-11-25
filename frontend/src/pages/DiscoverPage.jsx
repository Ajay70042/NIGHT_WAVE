import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play } from "lucide-react";
import { usePlayer, albumOf, getHighResArt, fallbackCovers } from "../lib/music";
import { fetchDiscoverMoods, fetchDiscoverMoodPlaylists } from "../lib/api";
import { AlbumCard, Cover, Section, TrackRow } from "../components/sonara/ui";

export function DiscoverPage() {
  const play = usePlayer((s) => s.play);
  const playPlaylist = usePlayer((s) => s.playPlaylist);
  const trendingTracks = usePlayer((s) => s.trendingTracks);
  const homeShelves = usePlayer((s) => s.homeShelves);
  const historyTracks = usePlayer((s) => s.historyTracks);

  const [categories, setCategories] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodPlaylists, setMoodPlaylists] = useState([]);
  const [loadingMood, setLoadingMood] = useState(false);

  useEffect(() => {
    fetchDiscoverMoods().then((cats) => {
      if (Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
      }
    });
  }, []);

  const openMood = async (item) => {
    setSelectedMood(item);
    setLoadingMood(true);
    setMoodPlaylists([]);
    const pls = await fetchDiscoverMoodPlaylists(item.params);
    setMoodPlaylists(pls);
    setLoadingMood(false);
  };

  const displayTracks = trendingTracks.length > 0 ? trendingTracks : historyTracks;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10 group-data-[layout=wide]:max-w-none group-data-[layout=wide]:px-10">
      <p className="label">Discover</p>
      <h1 className="font-display text-4xl mt-2">
        {selectedMood ? selectedMood.title : "Moods, genres & new sounds"}
      </h1>

      {selectedMood ? (
        <div className="mt-6">
          <button
            onClick={() => {
              setSelectedMood(null);
              setMoodPlaylists([]);
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6 cursor-pointer"
          >
            <ArrowLeft className="size-4" /> Back to Moods & Genres
          </button>

          {loadingMood ? (
            <div className="surface rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Loading {selectedMood.title} playlists from YouTube Music...
            </div>
          ) : moodPlaylists.length === 0 ? (
            <div className="surface rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No playlists found for {selectedMood.title}.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
              {moodPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => playPlaylist(pl.id)}
                  className="group text-left cursor-pointer"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl surface">
                    <Cover
                      src={getHighResArt(pl.thumbnail) || fallbackCovers[0]}
                      className="size-full transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center">
                      <span className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition scale-90 group-hover:scale-100 shadow-lg">
                        <Play className="size-4 fill-current ml-0.5" />
                      </span>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm font-medium truncate">{pl.title}</p>
                  {pl.description && (
                    <p className="text-xs text-muted-foreground truncate">{pl.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* YouTube Music Moods & Genres */}
          {categories.map((cat, cIdx) => (
            <Section key={cat.category || cIdx} title={cat.category}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {cat.items.map((item, i) => (
                  <motion.button
                    key={item.params + i}
                    whileHover={{ y: -3 }}
                    onClick={() => openMood(item)}
                    className="mood-tile rounded-xl p-5 h-20 text-left font-display text-base sm:text-lg truncate cursor-pointer"
                    style={{ "--h": (200 + (cIdx * 50) + i * 14) % 360 }}
                  >
                    {item.title}
                  </motion.button>
                ))}
              </div>
            </Section>
          ))}

          {/* Dynamic YouTube Music Charts (only if available) */}
          {displayTracks.length > 0 && (
            <Section title="Top Charts">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-5 group-data-[layout=wide]:xl:grid-cols-8">
                {displayTracks.slice(0, 6).map((t, i) => {
                  const alb = albumOf(t);
                  return (
                    <AlbumCard
                      key={t.id + i}
                      album={{ ...alb, title: t.title, artist: t.artist }}
                      i={i}
                      onPlay={() => play(t.id)}
                    />
                  );
                })}
              </div>
            </Section>
          )}

          {displayTracks.length > 6 && (
            <Section title="Rising tracks">
              {displayTracks.slice(6, 14).map((t, i) => (
                <TrackRow key={t.id} t={t} i={i} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
