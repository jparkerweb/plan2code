import { runCLI } from '../cli.js';

async function main() {
  try {
    await runCLI();
    process.exit(0);
  } catch (err) {
    if (err instanceof Error && err.message.includes('User force closed')) {
      // Ctrl+C — exit cleanly
      process.exit(0);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
