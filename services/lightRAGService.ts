import { Agent, ProposalOutput } from '../types';

export interface RAGDocument {
  id: string;
  content: string;
  metadata: {
    agentId?: string;
    phase?: number;
    timestamp: string;
    type: 'proposal' | 'decision' | 'context' | 'feedback';
  };
}

export interface RAGQuery {
  query: string;
  topK?: number;
  agentId?: string;
  phase?: number;
}

export interface RAGResult {
  documents: RAGDocument[];
  relevanceScores: number[];
}

class LightRAGService {
  private documents: RAGDocument[] = [];
  private sessionHistory: Map<string, RAGDocument[]> = new Map();

  // Store agent proposal/decision
  storeProposal(
    proposalId: string,
    agentId: string,
    phase: number,
    proposal: ProposalOutput
  ): void {
    const doc: RAGDocument = {
      id: proposalId,
      content: JSON.stringify(proposal),
      metadata: {
        agentId,
        phase,
        timestamp: new Date().toISOString(),
        type: 'proposal',
      },
    };
    this.documents.push(doc);
  }

  // Store agent decision
  storeDecision(
    decisionId: string,
    agentId: string,
    phase: number,
    decision: Record<string, any>
  ): void {
    const doc: RAGDocument = {
      id: decisionId,
      content: JSON.stringify(decision),
      metadata: {
        agentId,
        phase,
        timestamp: new Date().toISOString(),
        type: 'decision',
      },
    };
    this.documents.push(doc);
  }

  // Store context snapshot
  storeContext(
    contextId: string,
    phase: number,
    context: Record<string, any>
  ): void {
    const doc: RAGDocument = {
      id: contextId,
      content: JSON.stringify(context),
      metadata: {
        phase,
        timestamp: new Date().toISOString(),
        type: 'context',
      },
    };
    this.documents.push(doc);
  }

  // Retrieve relevant documents (basic semantic similarity)
  async query(params: RAGQuery): Promise<RAGResult> {
    const topK = params.topK || 5;
    const queryLower = params.query.toLowerCase();

    let candidates = this.documents;

    // Filter by agent/phase if specified
    if (params.agentId) {
      candidates = candidates.filter(d => d.metadata.agentId === params.agentId);
    }
    if (params.phase !== undefined) {
      candidates = candidates.filter(d => d.metadata.phase === params.phase);
    }

    // Simple keyword-based relevance scoring
    const scored = candidates.map(doc => {
      const contentLower = doc.content.toLowerCase();
      let score = 0;

      // Exact phrase match (highest priority)
      if (contentLower.includes(queryLower)) {
        score += 10;
      }

      // Word overlap
      const queryWords = queryLower.split(/\s+/);
      const contentWords = contentLower.split(/\s+/);
      const overlap = queryWords.filter(w => contentWords.includes(w)).length;
      score += overlap * 2;

      // Recency bonus
      const docAge = Date.now() - new Date(doc.metadata.timestamp).getTime();
      const recencyBonus = Math.max(0, 10 - docAge / (1000 * 60 * 60)); // decay over hours
      score += recencyBonus;

      return { doc, score };
    });

    // Sort by relevance and return top K
    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        doc: item.doc,
        score: item.score,
      }));

    return {
      documents: results.map(r => r.doc),
      relevanceScores: results.map(r => r.score),
    };
  }

  // Retrieve all proposals from a phase
  async getPhaseProposals(phase: number): Promise<ProposalOutput[]> {
    const proposals = this.documents
      .filter(d => d.metadata.phase === phase && d.metadata.type === 'proposal')
      .map(d => {
        try {
          return JSON.parse(d.content);
        } catch {
          return null;
        }
      })
      .filter(p => p !== null);

    return proposals;
  }

  // Retrieve agent decision history
  async getAgentDecisions(agentId: string): Promise<Record<string, any>[]> {
    const decisions = this.documents
      .filter(d => d.metadata.agentId === agentId && d.metadata.type === 'decision')
      .map(d => {
        try {
          return JSON.parse(d.content);
        } catch {
          return null;
        }
      })
      .filter(d => d !== null);

    return decisions;
  }

  // Create session checkpoint (for Phase 4 Ralph Loop)
  createSessionCheckpoint(sessionId: string): void {
    this.sessionHistory.set(sessionId, [...this.documents]);
  }

  // Restore from checkpoint
  restoreSessionCheckpoint(sessionId: string): boolean {
    const checkpoint = this.sessionHistory.get(sessionId);
    if (checkpoint) {
      this.documents = [...checkpoint];
      return true;
    }
    return false;
  }

  // Compress context for next phase (Phase 2 RLM feature)
  async compressContext(phase: number): Promise<string> {
    const phaseDocuments = this.documents.filter(d => d.metadata.phase === phase);
    
    const summary = {
      phase,
      totalDocuments: phaseDocuments.length,
      proposals: phaseDocuments.filter(d => d.metadata.type === 'proposal').length,
      decisions: phaseDocuments.filter(d => d.metadata.type === 'decision').length,
      agents: new Set(phaseDocuments.map(d => d.metadata.agentId)).size,
      keyInsights: this.extractKeyInsights(phaseDocuments),
    };

    return JSON.stringify(summary, null, 2);
  }

  private extractKeyInsights(documents: RAGDocument[]): string[] {
    const insights: string[] = [];
    
    if (documents.length === 0) return insights;

    // Extract from most recent documents
    const recent = documents.slice(-5);
    recent.forEach(doc => {
      try {
        const parsed = JSON.parse(doc.content);
        if (parsed.reasoning) {
          insights.push(parsed.reasoning);
        } else if (parsed.summary) {
          insights.push(parsed.summary);
        }
      } catch {
        // Skip parsing errors
      }
    });

    return insights.slice(0, 3);
  }

  // Clear all documents (for testing)
  clear(): void {
    this.documents = [];
    this.sessionHistory.clear();
  }

  // Get statistics
  getStats(): {
    totalDocuments: number;
    byType: Record<string, number>;
    byPhase: Record<number, number>;
    byAgent: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byPhase: Record<number, number> = {};
    const byAgent: Record<string, number> = {};

    this.documents.forEach(doc => {
      byType[doc.metadata.type] = (byType[doc.metadata.type] || 0) + 1;
      if (doc.metadata.phase !== undefined) {
        byPhase[doc.metadata.phase] = (byPhase[doc.metadata.phase] || 0) + 1;
      }
      if (doc.metadata.agentId) {
        byAgent[doc.metadata.agentId] = (byAgent[doc.metadata.agentId] || 0) + 1;
      }
    });

    return {
      totalDocuments: this.documents.length,
      byType,
      byPhase,
      byAgent,
    };
  }
}

export const lightRAGService = new LightRAGService();

export default lightRAGService;
