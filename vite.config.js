import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under any subpath (e.g. GitHub Pages).
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        screen: resolve(__dirname, 'screen.html'),
        play: resolve(__dirname, 'play.html'),
      },
    },
  },
});
