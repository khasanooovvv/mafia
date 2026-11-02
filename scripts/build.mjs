import { build } from 'esbuild';
await build({ entryPoints: ['client/app.js'], outfile: 'public/app.js', bundle: true, minify: true, format: 'esm', target: ['es2022'], sourcemap: false, loader: { '.svg': 'text', '.png': 'dataurl' } });
console.log('Mini App build tayyor: public/app.js');
