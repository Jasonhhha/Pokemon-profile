import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sourceIndex = readFileSync(new URL('./index.src.html', import.meta.url), 'utf8');
const indexPath = fileURLToPath(new URL('./index.html', import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Pokemon-profile/' : '/',
  plugins: [{ name: 'source-index-template', enforce: 'pre', load: id => id === indexPath ? sourceIndex : undefined }, react()],
});
