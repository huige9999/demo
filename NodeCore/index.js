import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('./data.json', import.meta.url), 'utf-8');
const data = JSON.parse(raw);

console.log('=== data.json 内容 ===');
console.log(JSON.stringify(data, null, 2));
