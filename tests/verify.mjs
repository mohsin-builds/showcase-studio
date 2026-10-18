import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const html = readFileSync(join(root, 'index.html'), 'utf8');
const js = readFileSync(join(root, 'assets/app.js'), 'utf8');
const css= readFileSync(join(root,'assets/style.css'), 'utf8');
execFileSync(process.execPath, ['--check', join(root,'assets/app.js')]);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
if(new Set(ids).size!==ids.length) throw new Error('Duplicate HTML IDs');
for (const id of ['exportQuality', 'exportContainer','downloadSrt','exportPreset','importPreset','presetInput','previewCanvas','renderButton','videoInput','logoInput','audioInput']) {
 if(!ids.includes(id)||!js.includes(`$('${id}')`))throw new Error('Control missing or not wired: '+id);
}
if(!js.includes('mediaCodecNotes') || !js.includes('mp4a') || !js.includes('Opus'))throw new Error('Missing audio compatibility note');
if(!js.includes('exportSizes')||!js.includes('1080,1920')||!js.includes('1920,1080'))throw new Error('Full HD profiles not found');
if(!js.includes('exportCaptions')||!js.includes('importEditingPreset'))throw new Error('Production functions missing');
for(const f of ['assets/favicon.svg','assets/sample-demo.mp4','assets/mohsin-tools-preview.webp','privacy.html','_headers','robots.txt']) if(!existsSync(join(root,f)))throw new Error('Missing asset '+f);
if(!css.includes('export-extras'))throw new Error('Export controls unstyled');
for(const forbidden of ['Loved by 10,000','Beta ·','BETA ·'])if(html.includes(forbidden))throw new Error('Unverified public marketing claim');
console.log('PASS: source syntax, unique IDs, upload/export controls, HD sizes, captions, reusable presets, assets, no fake social proof.');