import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  build: {
    target: 'esnext'
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  plugins: [solid(),
  tailwindcss(),
  viteStaticCopy({
    targets: [
      {
        dest: '.',
        src: './splashscreen.html'
      },
      {
        dest: '.',
        src: './src-tauri/icons/Square310x310Logo.png'
      }
    ]
  })
  ],
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    }
  },

}));
