// preload.js
const { contextBridge } = require('electron');
const { readFile } = require('fs/promises');
const { join } = require('path');

contextBridge.exposeInMainWorld('components', {
  load: async (relPath) => {
    try {
      const abs = join(__dirname, relPath); // стабільний шлях
      const html = await readFile(abs, 'utf8');
      return html;
    } catch (e) {
      console.error('[preload] load error:', e);
      return `<div style="padding:12px;color:#b91c1c;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;">
        Failed to load: <b>${relPath}</b><br>${e.message}
      </div>`;
    }
  }
});
