// vite.config.js
import { defineConfig } from "file:///C:/Users/sno_g/OneDrive/Desktop/Fit-Launcher/node_modules/vite/dist/node/index.js";
import solid from "file:///C:/Users/sno_g/OneDrive/Desktop/Fit-Launcher/node_modules/vite-plugin-solid/dist/esm/index.mjs";
import { viteStaticCopy } from "file:///C:/Users/sno_g/OneDrive/Desktop/Fit-Launcher/node_modules/vite-plugin-static-copy/dist/index.js";
var vite_config_default = defineConfig(async () => ({
  plugins: [
    solid(),
    viteStaticCopy({
      targets: [
        {
          src: "./splashscreen.html",
          dest: "."
        },
        {
          src: "./src-tauri/icons/Square310x310Logo.png",
          dest: "."
        }
      ]
    })
  ],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"]
    }
  },
  build: {
    target: "esnext"
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzbm9fZ1xcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXEZpdC1MYXVuY2hlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcc25vX2dcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxGaXQtTGF1bmNoZXJcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3Nub19nL09uZURyaXZlL0Rlc2t0b3AvRml0LUxhdW5jaGVyL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHNvbGlkIGZyb20gXCJ2aXRlLXBsdWdpbi1zb2xpZFwiO1xyXG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1zdGF0aWMtY29weVwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKGFzeW5jICgpID0+ICh7XHJcbiAgcGx1Z2luczogW3NvbGlkKCksXHJcbiAgICB2aXRlU3RhdGljQ29weSh7XHJcbiAgICAgICAgdGFyZ2V0czogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICcuL3NwbGFzaHNjcmVlbi5odG1sJywgIFxyXG4gICAgICAgICAgICBkZXN0OiAnLicgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJy4vc3JjLXRhdXJpL2ljb25zL1NxdWFyZTMxMHgzMTBMb2dvLnBuZycsIFxyXG4gICAgICAgICAgICBkZXN0OiAnLicgIFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgfSlcclxuICBdLFxyXG5cclxuICAvLyBWaXRlIG9wdGlvbnMgdGFpbG9yZWQgZm9yIFRhdXJpIGRldmVsb3BtZW50IGFuZCBvbmx5IGFwcGxpZWQgaW4gYHRhdXJpIGRldmAgb3IgYHRhdXJpIGJ1aWxkYFxyXG4gIC8vXHJcbiAgLy8gMS4gcHJldmVudCB2aXRlIGZyb20gb2JzY3VyaW5nIHJ1c3QgZXJyb3JzXHJcbiAgY2xlYXJTY3JlZW46IGZhbHNlLFxyXG4gIC8vIDIuIHRhdXJpIGV4cGVjdHMgYSBmaXhlZCBwb3J0LCBmYWlsIGlmIHRoYXQgcG9ydCBpcyBub3QgYXZhaWxhYmxlXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiAxNDIwLFxyXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSxcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIC8vIDMuIHRlbGwgdml0ZSB0byBpZ25vcmUgd2F0Y2hpbmcgYHNyYy10YXVyaWBcclxuICAgICAgaWdub3JlZDogW1wiKiovc3JjLXRhdXJpLyoqXCJdLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzbmV4dCdcclxuICB9LFxyXG4gIFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1UsU0FBUyxvQkFBb0I7QUFDL1YsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsc0JBQXNCO0FBRy9CLElBQU8sc0JBQVEsYUFBYSxhQUFhO0FBQUEsRUFDdkMsU0FBUztBQUFBLElBQUMsTUFBTTtBQUFBLElBQ2QsZUFBZTtBQUFBLE1BQ1gsU0FBUztBQUFBLFFBQ1A7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsTUFBTTtBQUFBLFFBQ1I7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDTDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsYUFBYTtBQUFBO0FBQUEsRUFFYixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUE7QUFBQSxNQUVMLFNBQVMsQ0FBQyxpQkFBaUI7QUFBQSxJQUM3QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxFQUNWO0FBRUYsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
