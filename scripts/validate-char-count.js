#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHAR_LIMIT = 11500;
const srcDir = path.join(__dirname, '..', 'src');

// Note: readdirSync is non-recursive, so files in subdirectories like
// plan2code-review-references/ are automatically excluded from
// the character limit check. Reference files have no char limit.
const files = fs.readdirSync(srcDir)
  .filter(f => /^plan2code(-.*)?\.md$/.test(f))
  .sort();

const failures = [];

for (const file of files) {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const charCount = content.length;
  if (charCount > CHAR_LIMIT) {
    failures.push({ file: path.join('src', file), charCount });
  }
}

if (failures.length > 0) {
  console.error('Character limit exceeded:');
  console.error('');
  for (const { file, charCount } of failures) {
    console.error(`  ${file}: ${charCount} / ${CHAR_LIMIT} (+${charCount - CHAR_LIMIT} over)`);
  }
  console.error('');
  console.error(`${failures.length} file(s) over the ${CHAR_LIMIT} character limit.`);
  process.exit(1);
}

console.log(`All ${files.length} files under ${CHAR_LIMIT} characters \u2713`);
process.exit(0);
