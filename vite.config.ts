import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two builds from the same code:
//   npm run build          -> dist/          multi-file site for GitHub Pages
//   npm run build:offline  -> dist-offline/  one self-contained index.html for the demo,
//                                            which opens straight from disk with no network
//
// base './' makes every asset path relative, so the site works under the
// GitHub Pages project URL (/cos750-final-project/) and from a local folder.
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: './',
    plugins: offline ? [viteSingleFile()] : [],
    build: {
      outDir: offline ? 'dist-offline' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
    },
  };
});
