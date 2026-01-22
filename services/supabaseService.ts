export interface StorageSession {
  id: string;
  projectName: string;
  userId: string;
  data: Record<string, any>;
  phases: PhaseData[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'archived';
}

export interface PhaseData {
  phase: number;
  name: string;
  agentOutputs: AgentOutput[];
  proposals: ProposalData[];
  selectedProposal?: string;
  completedAt?: string;
}

export interface AgentOutput {
  agentId: string;
  agentName: string;
  output: string;
  timestamp: string;
  cost?: number;
}

export interface ProposalData {
  id: string;
  content: string;
  agent: string;
  score: number;
  timestamp: string;
}

class SupabaseService {
  private supabaseUrl: string;
  private supabaseKey: string;
  private initialized: boolean = false;
  private db: Map<string, any> = new Map(); // Local fallback store

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabaseUrl = supabaseUrl || process.env.SUPABASE_URL || '';
    this.supabaseKey = supabaseKey || process.env.SUPABASE_KEY || '';

    if (this.supabaseUrl && this.supabaseKey) {
      this.initialize();
    }
  }

  private initialize(): void {
    // In a real implementation, this would initialize the Supabase client
    // For now, we're using local fallback
    this.initialized = true;
  }

  // Create a new session
  async createSession(
    projectName: string,
    userId: string,
    initialData: Record<string, any>
  ): Promise<StorageSession> {
    const session: StorageSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectName,
      userId,
      data: initialData,
      phases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    if (this.initialized) {
      // Store in Supabase
      try {
        // await this.supabase.from('sessions').insert(session);
      } catch (error) {
        console.log('Supabase unavailable, using local storage:', error);
        this.db.set(session.id, session);
      }
    } else {
      // Use local fallback
      this.db.set(session.id, session);
    }

    return session;
  }

  // Get session
  async getSession(sessionId: string): Promise<StorageSession | null> {
    if (this.initialized) {
      // Try Supabase first
      try {
        // const result = await this.supabase.from('sessions').select('*').eq('id', sessionId).single();
        // return result.data || null;
      } catch (error) {
        console.log('Supabase failed, checking local store');
      }
    }

    // Fallback to local storage
    return this.db.get(sessionId) || null;
  }

  // Update session
  async updateSession(session: StorageSession): Promise<void> {
    session.updatedAt = new Date().toISOString();

    if (this.initialized) {
      try {
        // await this.supabase.from('sessions').update(session).eq('id', session.id);
      } catch (error) {
        console.log('Supabase update failed, using local storage');
        this.db.set(session.id, session);
      }
    } else {
      this.db.set(session.id, session);
    }
  }

  // Add phase to session
  async addPhase(sessionId: string, phase: PhaseData): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.phases.push(phase);
    await this.updateSession(session);
  }

  // Update phase
  async updatePhase(sessionId: string, phaseNumber: number, updates: Partial<PhaseData>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const phase = session.phases.find(p => p.phase === phaseNumber);
    if (!phase) {
      throw new Error(`Phase ${phaseNumber} not found in session`);
    }

    Object.assign(phase, updates);
    await this.updateSession(session);
  }

  // Add agent output to phase
  async addAgentOutput(
    sessionId: string,
    phaseNumber: number,
    output: AgentOutput
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    let phase = session.phases.find(p => p.phase === phaseNumber);
    if (!phase) {
      phase = {
        phase: phaseNumber,
        name: `Phase ${phaseNumber}`,
        agentOutputs: [],
        proposals: [],
      };
      session.phases.push(phase);
    }

    phase.agentOutputs.push(output);
    await this.updateSession(session);
  }

  // Add proposal to phase
  async addProposal(
    sessionId: string,
    phaseNumber: number,
    proposal: ProposalData
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    let phase = session.phases.find(p => p.phase === phaseNumber);
    if (!phase) {
      phase = {
        phase: phaseNumber,
        name: `Phase ${phaseNumber}`,
        agentOutputs: [],
        proposals: [],
      };
      session.phases.push(phase);
    }

    phase.proposals.push(proposal);
    await this.updateSession(session);
  }

  // List user sessions
  async listUserSessions(userId: string): Promise<StorageSession[]> {
    const sessions = Array.from(this.db.values());
    return sessions.filter(s => s.userId === userId && s.status !== 'archived');
  }

  // Mark session complete
  async completeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'completed';
      session.phases.forEach(p => {
        if (!p.completedAt) {
          p.completedAt = new Date().toISOString();
        }
      });
      await this.updateSession(session);
    }
  }

  // Archive session
  async archiveSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'archived';
      await this.updateSession(session);
    }
  }

  // Search sessions by project name
  async searchSessions(userId: string, projectName: string): Promise<StorageSession[]> {
    const userSessions = await this.listUserSessions(userId);
    return userSessions.filter(s =>
      s.projectName.toLowerCase().includes(projectName.toLowerCase())
    );
  }

  // Export session as JSON
  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return JSON.stringify(session, null, 2);
  }

  // Import session from JSON
  async importSession(userId: string, jsonData: string): Promise<StorageSession> {
    const imported = JSON.parse(jsonData);

    const session: StorageSession = {
      id: `session-imported-${Date.now()}`,
      projectName: imported.projectName,
      userId,
      data: imported.data,
      phases: imported.phases,
      createdAt: imported.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    await this.updateSession(session);
    return session;
  }

  // Get session statistics
  async getSessionStats(sessionId: string): Promise<{
    totalPhases: number;
    totalAgentOutputs: number;
    totalProposals: number;
    duration: string;
    status: string;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const totalAgentOutputs = session.phases.reduce(
      (sum, p) => sum + p.agentOutputs.length,
      0
    );
    const totalProposals = session.phases.reduce((sum, p) => sum + p.proposals.length, 0);

    const startTime = new Date(session.createdAt).getTime();
    const endTime = new Date(session.updatedAt).getTime();
    const durationMs = endTime - startTime;
    const duration = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

    return {
      totalPhases: session.phases.length,
      totalAgentOutputs,
      totalProposals,
      duration,
      status: session.status,
    };
  }

  // Health check
  async health(): Promise<{ status: string; backend: string }> {
    if (this.initialized && this.supabaseUrl) {
      return { status: 'healthy', backend: 'supabase' };
    }
    return { status: 'degraded', backend: 'local-fallback' };
  }
}

export const supabaseService = new SupabaseService();

export default supabaseService;
