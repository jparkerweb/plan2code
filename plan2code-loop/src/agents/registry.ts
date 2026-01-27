import type { Agent } from './types.js';

class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  register(agent: Agent): void {
    this.agents.set(agent.config.name, agent);
  }

  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAvailable(): Promise<Agent[]> {
    return Promise.all(
      this.getAll().map(async (agent) => ({
        agent,
        available: await agent.isAvailable(),
      }))
    ).then((results) =>
      results.filter((r) => r.available).map((r) => r.agent)
    );
  }

  getNames(): string[] {
    return Array.from(this.agents.keys());
  }
}

export const agentRegistry = new AgentRegistry();
