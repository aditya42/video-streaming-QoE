import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('node_modules/shaka-player/dist/shaka-player.compiled.js');
const destination = resolve('web/vendor/shaka-player.compiled.js');

if (!existsSync(source)) {
  console.error(`Shaka bundle not found: ${source}`);
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`Copied Shaka Player to ${destination}`);
