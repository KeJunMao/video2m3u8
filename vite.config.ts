import { fileURLToPath, URL } from 'url'

import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";
import Unocss from "unocss/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src', import.meta.url)),
      '~/': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  plugins: [
    Vue(),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ["vue", "vue/macros", "@vueuse/core"],
      dts: "src/auto-imports.d.ts",
      dirs: ["src/composables", "src/store"],
      vueTemplate: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dts: "src/components.d.ts",
      resolvers: [NaiveUiResolver()],
    }),

    // https://github.com/antfu/unocss
    // see unocss.config.ts for config
    Unocss(),
  ],

  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
