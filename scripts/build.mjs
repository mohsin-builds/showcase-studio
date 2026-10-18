/** Build the customer-facing Cloudflare Pages directory from an isolated source repository. */
import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
const publicFiles = [
  'index.html',
  'privacy.html',
  'robots.txt',
  '_headers',
  'assets/app.js',
  'assets/style.css',
  'assets/favicon.svg',
  'assets/sample-demo.mp4',
  'assets/mohsin-tools-preview.webp',
];
for (const file of publicFiles) {
  if (!existsSync(join(root, file))) throw new Error(`Missing website asset: ${file}`);
}
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of publicFiles) {
  mkdirSync(resolve(output, file, '..'), { recursive: true });
  copyFileSync(join(root, file), join(output, file));
}
console.log(`Showcase Studio site prepared in dist/ (${publicFiles.length} public assets).`);