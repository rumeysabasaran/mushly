/*
  METRO CONFIG — Expo's bundler.
  Two extra settings, for the web preview only (they don't affect the phone):
  - .wasm files: the in-browser build of SQLite uses them.
  - Two security headers: the browser only allows the shared memory SQLite needs with these.
*/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
