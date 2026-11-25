import React, { useState } from "react";
import { usePlayer } from "../lib/music";
import { connectUserAccount, disconnectUserAccount } from "../lib/api";

const opts = [
  ["Crossfade between songs", "Blend the end of one track into the next"],
  ["Gapless playback", "Remove silence between album tracks"],
  ["Continuous Autoplay & Radio", "Queue similar songs from YouTube Music automatically"],
  ["Ambient background", "Tint the window with album artwork colors"],
  ["Show visualizer", "Subtle animated bars on the playing track"],
  ["Normalize volume", "Keep loudness consistent across songs"],
];

export function SettingsPage() {
  const [on, setOn] = useState([true, true, true, true, true, false]);
  const user = usePlayer((s) => s.userProfile);
  const userPlaylists = usePlayer((s) => s.userPlaylists);
  const likedTracks = usePlayer((s) => s.likedTracks);
  const syncWithBackend = usePlayer((s) => s.syncWithBackend);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [headersInput, setHeadersInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    if (!invoke) {
      setShowConnectModal(true);
      return;
    }
    setIsConnecting(true);
    try {
      const cookieHeader = await invoke("open_google_login");
      if (cookieHeader) {
        await connectUserAccount(cookieHeader);
        setShowConnectModal(false);
        setHeadersInput("");
        await syncWithBackend();
      }
    } catch (err) {
      const msg = typeof err === "string" ? err : err?.message || "Google sign-in failed";
      if (!msg.toLowerCase().includes("cancelled")) {
        setErrorMsg(msg);
        setShowConnectModal(true);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectUserAccount();
      const disconnectedProfile = {
        name: "",
        handle: "",
        email: "",
        avatar: "",
        connected: false,
      };
      usePlayer.setState({
        userProfile: disconnectedProfile,
        likedTracks: [],
        userPlaylists: [],
        historyTracks: [],
        homeShelves: [],
        favs: [],
      });
      // Write connected:false explicitly so next load won't see cached connected:true
      try {
        localStorage.setItem("sonara:user_profile", JSON.stringify(disconnectedProfile));
        localStorage.removeItem("sonara:liked_tracks");
        localStorage.removeItem("sonara:user_playlists");
        localStorage.removeItem("sonara:history_tracks");
        localStorage.removeItem("sonara:favs");
      } catch (_) {}
      // No need to syncWithBackend — we just disconnected; a sync would see
      // the backend is unauthenticated and correctly keep everything empty.
    } catch (e) {
      console.error("Disconnect error:", e);
    }
  };

  const handleConnectSubmit = async (e) => {
    e.preventDefault();
    if (!headersInput.trim()) return;
    setIsConnecting(true);
    setErrorMsg("");
    try {
      await connectUserAccount(headersInput.trim());
      setShowConnectModal(false);
      setHeadersInput("");
      await syncWithBackend();
    } catch (err) {
      setErrorMsg(err.message || "Failed to connect YouTube Music account");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 group-data-[layout=wide]:max-w-4xl">
      <p className="label">Profile</p>
      <h1 className="font-display text-4xl mt-2">Profile & Settings</h1>

      {/* Account Profile Card */}
      <div className="surface mt-8 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
        <div className="relative shrink-0">
          {user.connected && user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || "Profile"}
              className="size-16 rounded-full object-cover ring-1 ring-hairline"
            />
          ) : (
            <div className="size-16 rounded-full bg-secondary flex items-center justify-center ring-1 ring-hairline font-display text-xl text-muted-foreground">
              {user.connected ? (user.name?.[0] || "Y") : "?"}
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 size-3.5 rounded-full ring-2 ring-background ${
              user.connected ? "bg-primary" : "bg-muted-foreground"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="label">YouTube Music Account</p>
          <p className="font-display text-xl mt-1 truncate">
            {user.connected ? user.name || "YouTube Music User" : "Not connected"}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {user.connected ? (
              <>
                {user.handle && <span>{user.handle} · </span>}
                Connected · {likedTracks.length} Liked Songs · {userPlaylists.length} Playlists
              </>
            ) : (
              "Connect any YouTube Music account to stream your playlists, liked songs & history"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {user.connected ? (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={isConnecting}
                className="rounded-full border border-hairline px-4 py-2 text-xs hover:bg-secondary transition cursor-pointer disabled:opacity-50"
              >
                {isConnecting ? "Signing in..." : "Switch Account"}
              </button>
              <button
                onClick={handleDisconnect}
                className="rounded-full border border-red-500/30 text-red-400 px-4 py-2 text-xs hover:bg-red-500/10 transition cursor-pointer"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={isConnecting}
              className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs hover:opacity-90 transition cursor-pointer font-medium disabled:opacity-50"
            >
              {isConnecting ? "Signing in..." : "Connect Account"}
            </button>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface w-full max-w-lg rounded-2xl p-6 relative">
            <h2 className="font-display text-xl mb-1">Connect YouTube Music</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Connect any YouTube Music account to dynamically sync your playlists, likes, and history.
            </p>
            <div className="mb-4 rounded-xl bg-card p-3 text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">How to copy headers or cookie from any account:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Log in to <span className="text-foreground">music.youtube.com</span> in Chrome / Edge / Firefox.</li>
                <li>Press <span className="font-mono text-foreground">F12</span> to open Developer Tools, then open the <span className="text-foreground">Network</span> tab.</li>
                <li>Click any request to <span className="font-mono text-foreground">music.youtube.com</span> (e.g. browse, search).</li>
                <li>Right-click the request → <span className="text-foreground">Copy</span> → <span className="text-foreground">Copy request headers</span> (or copy the <span className="font-mono text-foreground">Cookie:</span> line).</li>
                <li>Paste it below and click Save & Sync.</li>
              </ol>
            </div>
            {errorMsg && <p className="text-xs text-red-400 mb-3">{errorMsg}</p>}
            <form onSubmit={handleConnectSubmit}>
              <textarea
                value={headersInput}
                onChange={(e) => setHeadersInput(e.target.value)}
                placeholder="Paste Cookie: ... or entire request headers block here"
                rows={5}
                className="field w-full rounded-xl p-3 text-xs outline-none resize-none font-mono"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="rounded-lg px-4 py-2 text-xs hover:bg-secondary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs hover:opacity-90 transition font-medium"
                >
                  {isConnecting ? "Connecting..." : "Save & Sync Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Options */}
      <p className="label mt-8">Settings</p>
      <div className="surface mt-3 rounded-2xl divide-y divide-hairline">
        {opts.map(([t, d], i) => (
          <div key={t} className="flex items-center justify-between gap-6 p-5">
            <div>
              <p className="text-sm font-medium">{t}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
            </div>
            <button
              role="switch"
              aria-checked={on[i]}
              aria-label={t}
              onClick={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
              className={`switch cursor-pointer ${on[i] ? "switch-on" : ""}`}
            >
              <span />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
