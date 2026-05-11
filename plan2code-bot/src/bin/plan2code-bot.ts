import { runCLI } from '../cli.js';

function showHelp(): void {
  console.log(`
+----------------------------------------------------------------+
�                   PLAN2CODEDE-BOT                            �
�----------------------------------------------------------------�
�  Autonomous workflow test runner foplan2codede              �
�  Features LLM-as-judge for honest quality evaluation          �
+----------------------------------------------------------------+

Usage:
  plan2code-bot [options]

Options:
  --help              Show this help message
  --idea <string>     Seed the idea generator with a specific concept
                      Example: --idea "web app for weather"
                      Example: --idea="CLI tool for CSV conversion"
  --resume            Resume a previous incomplete run

Modes:
  � New Project Mode - Run from empty directory
    The bot generates an app idea, creates a subdirectory, writes
    IDEA.md, runs init, then all 4 workflow steps.

  � Enhancement Mode - Run from directory with AGENTS.md
    The bot scans the existing codebase, proposes an enhancement,
    writes IDEA.md, then runs plan through finalize.

Evaluation:
  The bot acts as an authentic QA agent, using LLM-based decision
  making during execution and providing honest quality assessments
  after each step. Results are written to specs/<feature>/BOT-EVALUATION.md
  and specs/<feature>/BOT-NOTES.md for metrics analysis.

Examples:
  # New project (from empty directory)
  plan2code-bot

  # Enhancement (from existing project)
  cd my-project && plan2code-bot

  # With specific idea
  plan2code-bot --idea "markdown editor with live preview"

  # Resume incomplete run
  plan2code-bot --resume

Documentation:
  https://jparkerweb.github.io/plan2code
`);
}

function stripQuotes(str: string): string {
  // Remove surrounding quotes if present (both single and double)
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

function parseArgs(): { idea?: string; resume?: boolean; help?: boolean } {
  const args = process.argv.slice(2);

  // Check for --help
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  // Parse --idea (supports both --idea="value" and --idea "value")
  let idea: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Format: --idea="value"
    if (arg.startsWith('--idea=')) {
      idea = stripQuotes(arg.substring('--idea='.length));
      break;
    }

    // Format: --idea "value"
    if (arg === '--idea' && i + 1 < args.length) {
      idea = stripQuotes(args[i + 1]);
      break;
    }
  }

  // Parse --resume
  const resume = args.includes('--resume');

  return { idea, resume: resume || undefined };
}

async function main() {
  try {
    const { idea, resume, help } = parseArgs();

    if (help) {
      showHelp();
      process.exit(0);
    }

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
