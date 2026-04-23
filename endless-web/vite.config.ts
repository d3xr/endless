import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import mdx from '@mdx-js/rollup'
import { VitePWA } from 'vite-plugin-pwa'

// In demo mode (endless.vyroslo.ru) we overwrite the Workbox-generated
// service-worker.js with a kill-switch SW after the bundle is written.
// Reason: the demo origin previously hosted an authenticated build, so
// returning visitors still have that old SW registered. Without this,
// the old SW intercepts requests and keeps serving the old bundle
// (private data included). The kill-switch SW replaces the old one,
// clears all caches, unregisters itself, and reloads open tabs so the
// fresh bundle's boot-time storage wipe runs cleanly.
function demoKillSwitchSW(): Plugin {
  return {
    name: 'demo-kill-switch-sw',
    apply: 'build',
    // enforce: 'post' guarantees this runs after VitePWA's closeBundle,
    // which also writes service-worker.js. Without it, the plugin order
    // is non-deterministic and our kill switch can get overwritten by
    // Workbox output.
    enforce: 'post',
    closeBundle() {
      const src = path.resolve(__dirname, 'public/service-worker.js')
      const dest = path.resolve(__dirname, 'dist/service-worker.js')
      const killSwitch = fs.readFileSync(src, 'utf8')
      fs.writeFileSync(dest, killSwitch)
      const map = dest + '.map'
      if (fs.existsSync(map)) fs.unlinkSync(map)
    },
  }
}

export default defineConfig(({ mode }) => {
  const isDemo = mode.trim().toLowerCase() === 'demo'
  return {
    plugins: [
      tsconfigPaths(),
      react(),
      mdx(),
      VitePWA({
        registerType: 'autoUpdate',
        filename: 'service-worker.js',
        workbox: {
          maximumFileSizeToCacheInBytes: 3_000_000,
        },
      }),
      ...(isDemo ? [demoKillSwitchSW()] : []),
    ],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    envPrefix: 'REACT_APP_',
    define: {
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    test: {
      globals: true,
      environment: 'happy-dom',
    },
  }
})
