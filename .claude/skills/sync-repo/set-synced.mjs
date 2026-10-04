#!/usr/bin/env node
// set-synced.mjs: rewrite the "Last synced" line inside sync-repo.enc, in memory only.
// Decrypts, replaces exactly one anchored line, re-encrypts, then decrypts again to verify.
// Plaintext never touches disk and never passes through a shell pipe (PowerShell pipes
// re-encode UTF-8 through the console code page, which is how the body got mojibake).
// Usage: SKILL_PASSWORD=... node set-synced.mjs <file.enc> "<new value>"
//   e.g. node set-synced.mjs sync-repo.enc "v2.4.0 (main @ 1a2b3c4)"
import { readFileSync, writeFileSync } from 'node:fs';
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const MAGIC = Buffer.from('SENC', 'ascii');
const VERSION = 0x01;
const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEYLEN = 32, SALTLEN = 16, IVLEN = 12, TAGLEN = 16;
// Anchored to a whole line that starts with "**Last synced upstream:". Command text elsewhere in
// the body can mention the phrase without ever matching, because it never starts a line this way.
const LINE = /^\*\*Last synced upstream: .*\*\*$/gm;

const password = process.env.SKILL_PASSWORD;
const [encPath, value] = process.argv.slice(2);
if (!password) { console.error('ERROR: set SKILL_PASSWORD env var.'); process.exit(2); }
if (!encPath || !value) { console.error('Usage: node set-synced.mjs <file.enc> "<new value>"'); process.exit(2); }
if (value.includes('*') || value.includes('\n')) { console.error('ERROR: value may not contain * or a newline.'); process.exit(2); }

function decrypt(b64) {
  const blob = Buffer.from(b64.trim(), 'base64');
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC) || blob[MAGIC.length] !== VERSION) throw new Error('bad header');
  let off = MAGIC.length + 1;
  const salt = blob.subarray(off, off += SALTLEN);
  const iv = blob.subarray(off, off += IVLEN);
  const tag = blob.subarray(off, off += TAGLEN);
  const d = createDecipheriv('aes-256-gcm', scryptSync(password, salt, KEYLEN, SCRYPT), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(off)), d.final()]).toString('utf8');
}

function encrypt(text) {
  const salt = randomBytes(SALTLEN), iv = randomBytes(IVLEN);
  const c = createCipheriv('aes-256-gcm', scryptSync(password, salt, KEYLEN, SCRYPT), iv);
  const ct = Buffer.concat([c.update(Buffer.from(text, 'utf8')), c.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, c.getAuthTag(), ct]).toString('base64') + '\n';
}

let body;
try { body = decrypt(readFileSync(encPath, 'utf8')); }
catch { console.error('Decryption failed: wrong password or corrupted data.'); process.exit(1); }

const hits = body.match(LINE) || [];
if (hits.length !== 1) { console.error(`ERROR: expected exactly one "Last synced" line, found ${hits.length}. Nothing written.`); process.exit(1); }
if (body.includes('�')) { console.error('ERROR: body contains U+FFFD (encoding damage). Nothing written.'); process.exit(1); }

const next = body.replace(LINE, `**Last synced upstream: ${value}**`);
const out = encrypt(next);
if (decrypt(out) !== next) { console.error('ERROR: round-trip verification failed. Nothing written.'); process.exit(1); }
writeFileSync(encPath, out);
console.error(`Updated: ${hits[0]}  ->  **Last synced upstream: ${value}**`);
