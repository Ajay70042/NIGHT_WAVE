import React from "react";
import { Link, useNavigate } from "../lib/router";
import { albums, tracks, usePlayer, albumOf } from "../lib/music";
import { AlbumCard, Section, TrackRow } from "../components/sonara/ui";
import { FeaturedHero } from "../components/sonara/FeaturedHero";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomePage() {
  const play = usePlayer((s) => s.play);
  const setQueue = usePlayer((s) => s.setQueue);
  const playPlaylist = usePlayer((s) => s.playPlaylist);
  const user = usePlayer((s) => s.userProfile);
  const historyTracks = usePlayer((s) => s.historyTracks);
  const trendingTracks = usePlayer((s) => s.trendingTracks);
  const likedTracks = usePlayer((s) => s.likedTracks);
  const userPlaylists = usePlayer((s) => s.userPlaylists);
  const navigate = useNavigate();

  // Play an album or collection of tracks
  const playTrackList = (trackList) => {
    if (trackList && trackList.length > 0) {
      play(trackList[0].id);
      setQueue(trackList.slice(1).map((t) => t.id));
    }
  };

  // Recent items from YouTube Music history
  const recentTracks = historyTracks.length > 0 ? historyTracks.slice(0, 10) : likedTracks.slice(0, 8);

  // Trending items
  const trendingItems = trendingTracks.length > 0 ? trendingTracks.slice(0, 6) : likedTracks.slice(0, 6);

  const displayRecent = recentTracks;
  const displayTrending = trendingItems;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 group-data-[layout=wide]:max-w-none group-data-[layout=wide]:px-10">
      <p className="label">Today</p>
      <h1 className="font-display text-3xl mt-2">
        {greeting()}, {user.name ? user.name.split(" ")[0] : "Music Lover"}
      </h1>

      <FeaturedHero
        onPlay={() => {
          if (displayRecent.length > 0) playTrackList(displayRecent);
        }}
        onShuffle={() => {
          usePlayer.getState().toggleShuffle();
          if (displayRecent.length > 0) playTrackList(displayRecent);
        }}
      />

      {/* Your Playlists */}
      {userPlaylists.length > 0 && (
        <Section
          title="Your Playlists"
          action={
            <Link
              to="/library"
              search={{ tab: "playlists" }}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              See all ({userPlaylists.length})
            </Link>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-5 group-data-[layout=wide]:xl:grid-cols-8">
            {userPlaylists.slice(0, 6).map((p) => (
              <div
                key={p.id}
                onClick={() => navigate({ to: "/library", search: { tab: "playlists", id: p.id } })}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-xl shadow-art aspect-square bg-card">
                  <img
                    src={p.cover}
                    alt=""
                    className="size-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 card-scrim opacity-0 transition group-hover:opacity-100 flex items-end justify-end p-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playPlaylist(p.id);
                      }}
                      className="play-btn size-9 rounded-full grid place-items-center"
                    >
                      <span className="text-xs">▶</span>
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.count || p.ids?.length || 0} songs
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recently Played */}
      {displayRecent.length > 0 && (
        <Section
          title="Recently Played"
          action={
            <Link
              to="/library"
              search={{ tab: "recent" }}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              See all
            </Link>
          }
        >
          <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-none">
            {displayRecent.map((t, i) => {
              const alb = albumOf(t);
              return (
                <div key={t.id + i} className="w-44 shrink-0">
                  <AlbumCard
                    album={{ ...alb, title: t.title, artist: t.artist }}
                    i={i}
                    onPlay={() => play(t.id)}
                  />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12 group-data-[layout=wide]:lg:grid-cols-2 mt-6">
        {displayTrending.length > 0 && (
          <Section title="Trending now" sub="Popular on YouTube Music">
            <div className="flex flex-col">
              {displayTrending.map((t, i) => (
                <TrackRow key={t.id + i} t={t} i={i} showAlbum={false} />
              ))}
            </div>
          </Section>
        )}

        {likedTracks.length > 0 && (
          <Section title="Favorites & Made For You">
            <div className="grid grid-cols-2 gap-5 group-data-[layout=wide]:grid-cols-4">
              {likedTracks.slice(0, 4).map((item, i) => {
                const alb = item.albumId ? albumOf(item) : item;
                return (
                  <AlbumCard
                    key={(item.id || i) + "_fav"}
                    album={{ ...alb, title: item.title, artist: item.artist }}
                    i={i}
                    onPlay={() => play(item.id)}
                  />
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
