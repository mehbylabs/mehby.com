import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    // MDX turns `.mdx` into JSX, so it has to produce that JSX before the
    // React plugin looks for it. `enforce: 'pre'` guarantees the ordering,
    // and sitting directly above viteReact() in the array keeps the reason
    // visible. Run it after React instead and React is handed raw markdown.
    //
    // remark-frontmatter is not optional here. Without it the YAML block is
    // not frontmatter to MDX at all, it is a setext heading followed by
    // prose, and every case study page opens by printing its own metadata.
    // gray-matter reads that same block on the server; this stops the page
    // rendering it twice.
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkFrontmatter] }) },
    viteReact(),
  ],
})

export default config
