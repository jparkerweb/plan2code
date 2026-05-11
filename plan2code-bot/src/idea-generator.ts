import { query } from '@anthropic-ai/claude-agent-sdk';

interface IdeaResult {
  name: string;
  description: string;
}

function parseIdea(text: string): IdeaResult {
  const nameMatch = text.match(/NAME:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?:\n\n|$)/i);

  const name = nameMatch?.[1]?.trim() ?? 'auto-project';
  const description = descMatch?.[1]?.trim() ?? text.trim();

  // Ensure kebab-case
  const kebabName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return { name: kebabName, description };
}

export async function generateNewAppIdea(seed?: string): Promise<IdeaResult> {
  const categories = [
    'CLI tool',
    'single-page web app',
    'REST API service',
    'browser extension',
    'interactive data visualization dashboard',
    'terminal-based game',
    'real-time web app (using WebSockets)',
    'static site generator or theme',
    'browser-based game',
    'desktop utility (using Electron or Tauri)',
    'chat bot or conversational tool',
    'automation script or workflow tool',
  ];
  const category = categories[Math.floor(Math.random() * categories.length)];

  const seedClause = seed
    ? `\n\nThe user provided this seed for inspiration. Stay closely aligned with the theme and intent of the seed — build on it, don't ignore it:\n"${seed}"`
    : '';

  const prompt = `Generate a random, creative idea for a ${category}. The project should be achievable in a single coding session (1-2 hours) and should be interesting but not overly complex.

IMPORTANT: Be creative and diverse with your ideas. Avoid defaulting to developer-centric tools (git analyzers, code formatters, repo scanners, etc.) unless the category specifically calls for it. Think about ideas that would appeal to a broad audience — productivity, entertainment, education, health, finance, art, music, social, cooking, travel, fitness, etc.${seedClause}

Respond in EXACTLY this format (no other text):
NAME: <kebab-case-project-name>
DESCRIPTION: <2-3 sentence description of what the app does, its key features, and the tech stack to use>`;

  const session = query({
    prompt,
    options: {
      maxTurns: 1,
      systemPrompt: 'You are a wildly creative project idea generator. You come up with surprising, fun, and diverse software project ideas spanning many domains — not just developer tools. Respond only in the exact format requested.',
    },
  });

  let output = '';
  for await (const message of session) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          output += block.text;
        }
      }
    }
  }

  return parseIdea(output);
}

export async function generateEnhancementIdea(projectDir: string, seed?: string): Promise<IdeaResult> {
  const seedClause = seed
    ? `\n\nUse this as inspiration for the enhancement: "${seed}"`
    : '';

  const prompt = `You are in a project directory. Scan the existing codebase to understand what it does, then propose a realistic enhancement (new feature, refactor, improvement, or extension).

Use the Read, Glob, and Grep tools to explore the project. Look at:
- Package.json or similar config files for project info
- Source files for current functionality
- README or docs for context${seedClause}

Then respond in EXACTLY this format (no other text):
NAME: <kebab-case-enhancement-name>
DESCRIPTION: <2-3 sentence description of the enhancement, what it adds/changes, and why it would be valuable>`;

  const session = query({
    prompt,
    options: {
      maxTurns: 8,
      cwd: projectDir,
      tools: { type: 'preset', preset: 'claude_code' },
      allowedTools: ['Read', 'Glob', 'Grep'],
      systemPrompt: { type: 'preset', preset: 'claude_code' },
    },
  });

  let output = '';
  for await (const message of session) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          output += block.text;
        }
      }
    }
  }

  return parseIdea(output);
}
