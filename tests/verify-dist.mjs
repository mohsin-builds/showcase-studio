import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = join(root, 'dist');
const expected = [
  '_headers', 'index.html', 'privacy.html', 'robots.txt',
  'assets/app.js', 'assets/style.css', 'assets/favicon.svg',
  'assets/sample-demo.mp4', 'assets/mohsin-tools-preview.webp',
].sort();
function walk(d, rel='') { return readdirSync(d, { withFileTypes: true }).flatMap(ent => {
  const p = join(rel, ent.name);
  return ent.isDirectory() ? walk(join(d, ent.name), p) : [p.replaceAll('\\', '/')];
}); }
const actual = walk(dir).sort();
if (actual.join('\n') !== expected.join('\n')) throw new Error('Deployment content mismatch: '+JSON.stringify(actual));
const page=readFileSync(join(dir,'index.html'),'utf8');
if(!page.includes('/assets/app.js')&&!page.includes('assets/app.js'))throw new Error('Missing app entry');
if(!existsSync(join(dir,'assets/sample-demo.mp4')))throw new Error('Missing preview footage');
console.log(`PASS: ${actual.length} public assets; source/tests/credentials excluded.`);