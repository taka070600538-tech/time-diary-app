import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

function pngSize(path) {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const sw = readFileSync('sw.js', 'utf8');
const assets = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);

test('manifestの全アイコンが存在し実寸が一致する', () => {
  for (const icon of manifest.icons) {
    assert.ok(existsSync(icon.src), `${icon.src} がない`);
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(icon.src);
    assert.equal(actual.width, w, `${icon.src} width`);
    assert.equal(actual.height, h, `${icon.src} height`);
  }
});

test('maskableはmaskable版だけに付いている', () => {
  const maskables = manifest.icons.filter((i) => i.purpose === 'maskable');
  assert.equal(maskables.length, 1);
  assert.ok(maskables[0].src.includes('maskable'));
});

test('sw.jsのASSETSに主要ファイルが含まれ、実在する', () => {
  for (const icon of manifest.icons) assert.ok(assets.includes('./' + icon.src));
  for (const js of readdirSync('js')) assert.ok(assets.includes(`./js/${js}`), `./js/${js}`);
  for (const path of assets) {
    if (path === './') continue;
    assert.ok(existsSync(path), `${path} がASSETSにあるが実在しない`);
  }
});

test('sw.jsはapp-syncのsync.jsをキャッシュしない', () => {
  assert.ok(!sw.includes('app-sync'));
});
