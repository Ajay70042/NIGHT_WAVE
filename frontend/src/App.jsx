import React, { useEffect } from "react";
import { RouterProvider, useRouterState } from "./lib/router";
import { Shell } from "./components/sonara/Shell";
import { HomePage } from "./pages/HomePage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LyricsPage } from "./pages/LyricsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { pingHealth } from "./lib/api";

function AppContent() {
  const loc = useRouterState({ select: (s) => s.location });
  const path = loc.pathname;

  return (
    <Shell>
      {path === "/" && <HomePage />}
      {path === "/discover" && <DiscoverPage />}
      {path === "/library" && <LibraryPage />}
      {path === "/lyrics" && <LyricsPage />}
      {path === "/settings" && <SettingsPage />}
    </Shell>
  );
}

export default function App() {
  useEffect(() => {
    pingHealth();
  }, []);

  return (
    <RouterProvider initialPath="/">
      <AppContent />
    </RouterProvider>
  );
}
