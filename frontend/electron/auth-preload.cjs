// auth-preload.cjs: Removes embedded Chromium indicators so Google OAuth passes securely
try {
  delete Object.getPrototypeOf(navigator).userAgentData;
  Object.defineProperty(navigator, "userAgentData", {
    get: () => undefined,
    configurable: true,
  });
} catch (_) {}
