import { execa, type Options as ExecaOptions } from 'execa';

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB

function truncateOutput(output: string, maxSize: number): string {
  if (output.length > maxSize) {
    return output.slice(0, maxSize) + '\n...[truncated]';
  }
  return output;
}

export interface ExecuteOptions {
  command: string;
  args: string[];
  cwd: string;
  timeout: number;        // milliseconds
  env?: Record<string, string>;
  signal?: AbortSignal;   // For cancellation
  stdin?: string;         // Input to pass via stdin as string
  stdinFile?: string;     // Path to file to pipe as stdin
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  cancelled: boolean;
  duration: number;       // milliseconds
}

export async function executeCommand(
  options: ExecuteOptions
): Promise<ExecuteResult> {
  const startTime = Date.now();

  try {
    const execaOptions: ExecaOptions = {
      cwd: options.cwd,
      timeout: options.timeout,
      env: { ...process.env, ...options.env },
      reject: false,
      all: true,
    };

    // Add cancellation signal if provided
    if (options.signal) {
      (execaOptions as any).cancelSignal = options.signal;
    }

    // Add stdin input if provided (string or file)
    if (options.stdin) {
      (execaOptions as any).input = options.stdin;
    } else if (options.stdinFile) {
      (execaOptions as any).inputFile = options.stdinFile;
    }

    const result = await execa(options.command, options.args, execaOptions);

    return {
      stdout: truncateOutput(result.stdout || '', MAX_OUTPUT_SIZE),
      stderr: truncateOutput(result.stderr || '', MAX_OUTPUT_SIZE),
      exitCode: result.exitCode ?? 1,
      timedOut: result.timedOut ?? false,
      cancelled: result.isCanceled ?? false,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    // Check if this was a cancellation
    const isCancelled = error?.isCanceled || options.signal?.aborted;

    return {
      stdout: error?.stdout || '',
      stderr: error?.stderr || (error instanceof Error ? error.message : String(error)),
      exitCode: isCancelled ? -1 : 1,
      timedOut: false,
      cancelled: isCancelled,
      duration: Date.now() - startTime,
    };
  }
}
