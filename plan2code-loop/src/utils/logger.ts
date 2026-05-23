import chalk from 'chalk';
import ora, { type Ora } from 'ora';

// mascot - our friendly robot assistant
export const MASCOT = {
  // Full mascot for headers
  full: [
    '   ╭───╮   ',
    '   │ ● │   ',
    '   │ ◡ │   ',
    '   ╰───╯   ',
  ],
  // Mini mascot for inline use
  mini: '(◉‿◉)',
  // Waving mascot for greetings
  wave: [
    '   ╭───╮   ',
    '   │ ● │   ',
    '   │ ◡ │   ',
    '   ╰───╯   ',
  ],
  // Celebration mascot for completion
  celebrate: [
    '   ╭───╮   ',
    '   │ ★ │   ',
    '   │ ◡ │   ',
    '   ╰───╯   ',
  ],
};

export const logger = {
  info: (message: string) => console.log(chalk.blue('i'), message),
  success: (message: string) => console.log(chalk.green('+'), message),
  warning: (message: string) => console.log(chalk.yellow('!'), message),
  error: (message: string) => console.log(chalk.red('x'), message),

  dim: (message: string) => console.log(chalk.dim(message)),
  bold: (message: string) => console.log(chalk.bold(message)),

  header: (message: string) => {
    console.log();
    console.log(chalk.cyan.bold(message));
    console.log(chalk.cyan('-'.repeat(message.length)));
  },

  task: (phase: number, taskId: string, description: string) => {
    console.log(
      chalk.cyan(`[Phase ${phase}]`),
      chalk.yellow(`Task ${taskId}:`),
      chalk.white(description)
    );
  },

  iteration: (num: number, max: number, status: string) => {
    console.log(
      chalk.cyan(`[${num}/${max}]`),
      chalk.white(status)
    );
  },

  specContent: (content: string) => {
    console.log(chalk.dim('-'.repeat(50)));
    console.log(chalk.white(content));
    console.log(chalk.dim('-'.repeat(50)));
  },

  spinner: (text: string): Ora => ora({ text, color: 'cyan' }).start(),

  // Display mascot with optional message
  mascot: (variant: keyof typeof MASCOT = 'full', message?: string) => {
    console.log();
    const mascot = MASCOT[variant];
    if (Array.isArray(mascot)) {
      const mascotLines = [...mascot];
      if (message) {
        // Add message next to mascot (at the "mouth" line)
        mascotLines[4] = mascotLines[4] + '   ' + chalk.cyan(message);
      }
      mascotLines.forEach((line) => console.log(chalk.yellow(line)));
    } else {
      // Mini variant
      console.log(chalk.yellow(mascot), message ? chalk.cyan(message) : '');
    }
    console.log();
  },

  // Welcome banner with mascot
  welcome: () => {
    console.log();
    console.log(chalk.cyan.bold('═'.repeat(50)));
    MASCOT.wave.forEach((line, i) => {
      if (i === 4) {
        console.log(chalk.yellow(line) + '   ' + chalk.cyan.bold("Hi!"));
      } else if (i === 5) {
        console.log(chalk.yellow(line) + '   ' + chalk.dim('I\'m Your Plan2Code assistant'));
      } else {
        console.log(chalk.yellow(line));
      }
    });
    console.log(chalk.cyan.bold('═'.repeat(50)));
    console.log();
  },

  // Completion celebration with reminder
  allPhasesComplete: () => {
    console.log();
    console.log(chalk.green.bold('═'.repeat(50)));
    MASCOT.celebrate.forEach((line, i) => {
      if (i === 4) {
        console.log(chalk.yellow(line) + '   ' + chalk.green.bold('All phases complete!'));
      } else if (i === 5) {
        console.log(chalk.yellow(line) + '   ' + chalk.cyan('Great work!'));
      } else {
        console.log(chalk.yellow(line));
      }
    });
    console.log(chalk.green.bold('═'.repeat(50)));
    console.log();
    console.log(chalk.cyan.bold('Next Step:'));
    console.log(chalk.white('  Return to your AI Agent and run the'), chalk.yellow.bold('/plan2code-4-finalize'), chalk.white('step.'));
    console.log(chalk.dim('  This will ensure quality, completeness, and proper documentation.'));
    console.log();
  },
};

export type Logger = typeof logger;
