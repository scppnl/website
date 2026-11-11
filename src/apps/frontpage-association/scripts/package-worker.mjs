import { build } from 'esbuild';
await build({entryPoints:['dist/server/server.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'neutral',target:'es2022',minify:true,alias:{xhr2:'./scripts/xhr-worker.mjs'}});
