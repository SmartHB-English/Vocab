import { build } from 'esbuild';
await build({entryPoints:['functions/src/index.mjs'],outfile:'functions/index.js',bundle:true,format:'esm',platform:'node',target:'node22',
  external:['firebase-admin','firebase-functions'],alias:{'firebase/firestore':'./functions/src/admin-firestore.mjs'},legalComments:'eof'});
