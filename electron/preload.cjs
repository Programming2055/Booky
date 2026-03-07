'use strict';

// Preload scripts run in an isolated context before the renderer process.
// Use contextBridge to expose limited Node.js / Electron APIs to the renderer
// when needed. For Booky the renderer only needs browser APIs (IndexedDB, etc.),
// so no additional APIs are exposed here.
