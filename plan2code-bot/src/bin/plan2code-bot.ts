import { runCLI } from '../cli.js';

function parseArgs(): { idea?: string; resume?: boolean } {
  const args = process.argv.slice(2);
  const ideaIdx = args.indexOf('--idea');
  const idea = ideaIdx !== -1 && ideaIdx + 1 < args.length ? args[ideaIdx + 1] : undefined;
  const resume = args.includes('--resume');
  return { idea, resume: resume || undefined };
}

async function main() {
  try {
    const { idea, resume } = parseArgs();
    await runCLI({ idea, resume });
    process.exit(0);
  } catch (err) {
    if (err instanceof Error && err.message.includes('User force closed')) {
      process.exit(0);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
