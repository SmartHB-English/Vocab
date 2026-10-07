import { build } from 'esbuild';
await build({entryPoints:['services/firestore-entry.mjs'],outfile:'services/firestore.bundle.js',bundle:true,format:'iife',platform:'browser',target:['safari15','chrome90'],minify:true,legalComments:'eof'});
