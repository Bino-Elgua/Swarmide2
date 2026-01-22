/**
 * Phase 5: Proposal Caching Service
 * 
 * Caches proposals to enable:
 * 1. Fast re-evaluation without re-running agents
 * 2. Cross-project proposal reuse
 * 3. Historical analysis of proposal effectiveness
 * 4. Proposal versioning and rollback
 */

import { ProposalOutput } from '../types';

export interface CachedProposal extends ProposalOutput {
  cacheKey: string;
  cached: Date;
  hitCount: number;
  lastAccessed: Date;
  evaluations: ProposalEvaluation[];
  tags: string[];
  projectContext?: string;
}

export interface ProposalEvaluation {
  timestamp: Date;
  selectedCount: number;
  rejectedCount: number;
  userFeedback?: string;
  resolvedInPhase?: number;
  successScore: number; // 0-1: how well it worked in practice
}

export interface ProposalCacheIndex {
  totalCached: number;
  hitRate: number;
  averageEvaluationScore: number;
  topProposals: CachedProposal[];
  recentlyUsed: CachedProposal[];
}

export interface CachingStrategy {
  enabled: boolean;
  maxCacheSize: number;
  ttlMinutes?: number;
  minReusabilityScore?: number;
  persistToStorage: boolean;
}

const DEFAULT_CACHING_STRATEGY: CachingStrategy = {
  enabled: true,
  maxCacheSize: 1000,
  ttlMinutes: 1440, // 24 hours
  minReusabilityScore: 0.6,
  persistToStorage: true
};

/**
 * In-memory cache with optional persistence to localStorage
 */
class ProposalCacheManager {
  private cache: Map<string, CachedProposal> = new Map();
  private strategy: CachingStrategy;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(strategy: Partial<CachingStrategy> = {}) {
    this.strategy = { ...DEFAULT_CACHING_STRATEGY, ...strategy };
    this.loadFromStorage();
  }

  /**
   * Generate deterministic cache key from proposal context
   */
  generateCacheKey(
    prompt: string,
    agentId: string,
    phaseNumber: number,
    projectType: string
  ): string {
    const input = `${prompt}|${agentId}|${phaseNumber}|${projectType}`;
    // Simple hash (in production, use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `proposal_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Store proposal in cache
   */
  set(proposal: ProposalOutput, cacheKey: string, context?: string): CachedProposal {
    const cached: CachedProposal = {
      ...proposal,
      cacheKey,
      cached: new Date(),
      hitCount: 0,
      lastAccessed: new Date(),
      evaluations: [],
      tags: [],
      projectContext: context
    };

    // Enforce max cache size (FIFO eviction)
    if (this.cache.size >= this.strategy.maxCacheSize) {
      const oldest = Array.from(this.cache.values()).sort(
        (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
      )[0];
      if (oldest) this.cache.delete(oldest.cacheKey);
    }

    this.cache.set(cacheKey, cached);
    if (this.strategy.persistToStorage) {
      this.saveToStorage();
    }
    return cached;
  }

  /**
   * Retrieve proposal from cache
   */
  get(cacheKey: string): CachedProposal | null {
    const proposal = this.cache.get(cacheKey);
    if (proposal) {
      proposal.hitCount++;
      proposal.lastAccessed = new Date();
      this.totalHits++;
      return proposal;
    }
    this.totalMisses++;
    return null;
  }

  /**
   * Find similar proposals by keywords/tags
   */
  findSimilar(keywords: string[], maxResults: number = 5): CachedProposal[] {
    const scored = Array.from(this.cache.values()).map(p => ({
      proposal: p,
      score: this.calculateSimilarity(p, keywords)
    }));

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(s => s.proposal);
  }

  /**
   * Calculate proposal similarity to search keywords
   */
  private calculateSimilarity(proposal: CachedProposal, keywords: string[]): number {
    const text = `${proposal.architecture} ${proposal.rationale} ${proposal.tags.join(' ')}`.toLowerCase();
    const matches = keywords.filter(k => text.includes(k.toLowerCase())).length;
    return matches / Math.max(keywords.length, 1);
  }

  /**
   * Log proposal evaluation for success tracking
   */
  recordEvaluation(cacheKey: string, evaluation: Omit<ProposalEvaluation, 'timestamp'>): void {
    const proposal = this.cache.get(cacheKey);
    if (proposal) {
      proposal.evaluations.push({
        ...evaluation,
        timestamp: new Date()
      });
      if (this.strategy.persistToStorage) {
        this.saveToStorage();
      }
    }
  }

  /**
   * Calculate success score (0-1) based on evaluations
   */
  getSuccessScore(cacheKey: string): number {
    const proposal = this.cache.get(cacheKey);
    if (!proposal || proposal.evaluations.length === 0) {
      return 0.5; // neutral if no data
    }

    const avgScore = proposal.evaluations.reduce((sum, e) => sum + e.successScore, 0) 
      / proposal.evaluations.length;
    
    // Weight by recency: recent evaluations count more
    const now = Date.now();
    const weighted = proposal.evaluations
      .map(e => {
        const age = now - e.timestamp.getTime();
        const weight = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // decay over 7 days
        return e.successScore * weight;
      })
      .reduce((sum, v) => sum + v, 0) / proposal.evaluations.length;

    return weighted;
  }

  /**
   * Get cache statistics
   */
  getStats(): ProposalCacheIndex {
    const total = this.cache.size;
    const topProposals = Array.from(this.cache.values())
      .sort((a, b) => this.getSuccessScore(b.cacheKey) - this.getSuccessScore(a.cacheKey))
      .slice(0, 10);

    const recentlyUsed = Array.from(this.cache.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
      .slice(0, 10);

    const avgScore = total > 0
      ? topProposals.reduce((sum, p) => sum + this.getSuccessScore(p.cacheKey), 0) / total
      : 0;

    return {
      totalCached: total,
      hitRate: this.totalHits / Math.max(this.totalHits + this.totalMisses, 1),
      averageEvaluationScore: avgScore,
      topProposals,
      recentlyUsed
    };
  }

  /**
   * Clear old cache entries (TTL-based)
   */
  prune(): number {
    if (!this.strategy.ttlMinutes) return 0;

    const now = Date.now();
    const ttl = this.strategy.ttlMinutes * 60 * 1000;
    let removed = 0;

    for (const [key, proposal] of this.cache.entries()) {
      if (now - proposal.cached.getTime() > ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0 && this.strategy.persistToStorage) {
      this.saveToStorage();
    }

    return removed;
  }

  /**
   * Persist cache to localStorage
   */
  private saveToStorage(): void {
    try {
      const cacheData = Array.from(this.cache.values()).map(p => ({
        ...p,
        cached: p.cached.toISOString(),
        lastAccessed: p.lastAccessed.toISOString(),
        evaluations: p.evaluations.map(e => ({
          ...e,
          timestamp: e.timestamp.toISOString()
        }))
      }));
      localStorage.setItem('swarmide_proposal_cache', JSON.stringify(cacheData));
    } catch (err) {
      console.error('Failed to persist proposal cache:', err);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('swarmide_proposal_cache');
      if (!stored) return;

      const data = JSON.parse(stored) as any[];
      this.cache.clear();

      data.forEach(p => {
        const cached: CachedProposal = {
          ...p,
          cached: new Date(p.cached),
          lastAccessed: new Date(p.lastAccessed),
          evaluations: p.evaluations.map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp)
          }))
        };
        this.cache.set(cached.cacheKey, cached);
      });
    } catch (err) {
      console.error('Failed to load proposal cache:', err);
      this.cache.clear();
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
    try {
      localStorage.removeItem('swarmide_proposal_cache');
    } catch (err) {
      console.error('Failed to clear cache from storage:', err);
    }
  }
}

// Export singleton instance
export const proposalCache = new ProposalCacheManager();

/**
 * Proposal reuse recommendation engine
 */
export async function findReuseableProposal(
  prompt: string,
  agentId: string,
  phaseNumber: number,
  projectType: string,
  minSimilarity: number = 0.75
): Promise<CachedProposal | null> {
  // Generate cache key
  const keywords = prompt.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  
  // Search cache
  const candidates = proposalCache.findSimilar(keywords, 20);
  
  // Filter by relevance and success
  const viable = candidates.filter(p => 
    proposalCache.getSuccessScore(p.cacheKey) >= 0.7 &&
    p.agentId === agentId &&
    p.phase === phaseNumber
  );

  return viable.length > 0 ? viable[0] : null;
}

/**
 * Batch cache warmup from previous runs
 */
export async function warmCacheFromHistory(
  proposals: ProposalOutput[],
  projectContext?: string
): Promise<void> {
  proposals.forEach(p => {
    const key = proposalCache.generateCacheKey(
      p.architecture,
      p.agentId,
      0,
      'general'
    );
    proposalCache.set(p, key, projectContext);
  });
}
