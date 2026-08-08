import path from 'path';
import fs from 'fs-extra';
import type { SessionConfig, IterationLogEntry, SessionState } from './config.js';
import { DEFAULT_CONFIG } from './config.js';
import { computeHash, hashesMatch } from './hash.js';

const SCRATCHPAD_TEMPLATE = `# Scratchpad

Session notes appended by LLM during implementation.

---

`;

export class StateManager {
  private readonly stateDir: string;
  private readonly configPath: string;
  private readonly scratchpadPath: string;
  private readonly logPath: string;
  private readonly hashPath: string;
  private specPath: string | null = null;

  constructor(cwd: string = process.cwd()) {
    // Default to project root - will be updated when spec is selected
    this.stateDir = path.join(cwd, '.plan2code-loop');
    this.configPath = path.join(this.stateDir, 'config.json');
    this.scratchpadPath = path.join(this.stateDir, 'scratchpad.md');
    this.logPath = path.join(this.stateDir, 'iteration.log');
    this.hashPath = path.join(this.stateDir, 'spec.hash');
  }

  /**
   * Set the spec path and update all state paths to be inside the spec directory
   */
  setSpecPath(specPath: string): void {
    this.specPath = specPath;
    const stateDir = path.join(specPath, '.plan2code-loop');
    // Update all paths to be relative to spec directory
    (this as any).stateDir = stateDir;
    (this as any).configPath = path.join(stateDir, 'config.json');
    (this as any).scratchpadPath = path.join(stateDir, 'scratchpad.md');
    (this as any).logPath = path.join(stateDir, 'iteration.log');
    (this as any).hashPath = path.join(stateDir, 'spec.hash');
  }

  // Directory operations

  async ensureStateDir(): Promise<boolean> {
    const existed = await fs.pathExists(this.stateDir);
    await fs.ensureDir(this.stateDir);
    return existed;
  }

  getStateDir(): string {
    return this.stateDir;
  }

  // Config operations

  async readConfig(): Promise<SessionConfig | null> {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(content) as SessionConfig;
    } catch {
      return null;
    }
  }

  async writeConfig(config: SessionConfig): Promise<void> {
    await fs.writeFile(
      this.configPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );
  }

  async updateConfig(updates: Partial<SessionConfig>): Promise<SessionConfig> {
    const existing = await this.readConfig();
    const updated = { ...DEFAULT_CONFIG, ...existing, ...updates } as SessionConfig;
    await this.writeConfig(updated);
    return updated;
  }

  async incrementIteration(): Promise<number> {
    const config = await this.readConfig();
    if (!config) throw new Error('No session config found');
    config.currentIteration++;
    await this.writeConfig(config);
    return config.currentIteration;
  }

  // Session state detection

  async hasExistingSession(): Promise<boolean> {
    const [configExists, scratchpadExists] = await Promise.all([
      fs.pathExists(this.configPath),
      fs.pathExists(this.scratchpadPath),
    ]);
    return configExists || scratchpadExists;
  }

  async detectSessionState(specPath: string): Promise<SessionState> {
    // Ensure we're using the correct spec path
    this.setSpecPath(specPath);

    const hasSession = await this.hasExistingSession();
    if (!hasSession) {
      return 'new';
    }

    // Check if the spec path has changed
    const existingConfig = await this.readConfig();
    if (existingConfig && existingConfig.specPath !== specPath) {
      return 'changed';
    }

    // Check if spec content has changed (using hash of overview.md)
    const specChanged = await this.hasSpecChanged(specPath);
    return specChanged ? 'changed' : 'continue';
  }

  // Hash management for spec change detection

  async computeSpecHash(specPath: string): Promise<string> {
    const overviewPath = path.join(specPath, 'overview.md');
    try {
      const content = await fs.readFile(overviewPath, 'utf8');
      return computeHash(content);
    } catch {
      return '';
    }
  }

  async readStoredHash(): Promise<string | null> {
    try {
      return await fs.readFile(this.hashPath, 'utf8');
    } catch {
      return null;
    }
  }

  async storeHash(hash: string): Promise<void> {
    await fs.writeFile(this.hashPath, hash, 'utf8');
  }

  async hasSpecChanged(specPath: string): Promise<boolean> {
    const stored = await this.readStoredHash();
    if (!stored) return true;
    const current = await this.computeSpecHash(specPath);
    return !hashesMatch(stored, current);
  }

  async updateSpecHash(specPath: string): Promise<void> {
    const hash = await this.computeSpecHash(specPath);
    await this.storeHash(hash);
  }

  // Scratchpad operations

  async initializeScratchpad(): Promise<void> {
    await fs.writeFile(this.scratchpadPath, SCRATCHPAD_TEMPLATE, 'utf8');
  }

  async readScratchpad(): Promise<string> {
    try {
      return await fs.readFile(this.scratchpadPath, 'utf8');
    } catch {
      return '';
    }
  }

  async writeScratchpad(content: string): Promise<void> {
    await fs.writeFile(this.scratchpadPath, content, 'utf8');
  }

  // Iteration log operations

  async appendIterationLog(entry: IterationLogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.logPath, line, 'utf8');
  }

  async readIterationLog(): Promise<IterationLogEntry[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf8');
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as IterationLogEntry);
    } catch {
      return [];
    }
  }

  async getLastIteration(): Promise<IterationLogEntry | null> {
    const log = await this.readIterationLog();
    return log.length > 0 ? log[log.length - 1] : null;
  }

  // State clearing and initialization

  async clearState(): Promise<void> {
    const filesToDelete = [
      this.scratchpadPath,
      this.configPath,
      this.logPath,
      this.hashPath,
    ];

    await Promise.all(
      filesToDelete.map((file) => fs.remove(file).catch(() => {}))
    );
  }

  async initializeNewSession(config: SessionConfig): Promise<void> {
    // Ensure spec path is set before initializing
    this.setSpecPath(config.specPath);

    await this.clearState();
    await this.ensureStateDir();
    await this.initializeScratchpad();
    await this.writeConfig({
      ...config,
      startedAt: new Date().toISOString(),
      currentIteration: 0,
    });
    const hash = await this.computeSpecHash(config.specPath);
    await this.storeHash(hash);
  }
}
