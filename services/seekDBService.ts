export interface SeekDBDocument {
  id: string;
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
  score?: number;
}

export interface SeekDBQuery {
  query: string;
  limit?: number;
  filters?: Record<string, any>;
}

export interface SeekDBSearchResult {
  documents: SeekDBDocument[];
  totalCount: number;
  queryTime: number;
}

class SeekDBService {
  private documents: Map<string, SeekDBDocument> = new Map();
  private textIndex: Map<string, Set<string>> = new Map(); // Inverted index
  private vectorIndex: SeekDBDocument[] = []; // Simple vector store

  // Add document to index
  async addDocument(document: SeekDBDocument): Promise<void> {
    this.documents.set(document.id, document);

    // Build text index
    const words = document.text.toLowerCase().split(/\W+/);
    words.forEach(word => {
      if (!this.textIndex.has(word)) {
        this.textIndex.set(word, new Set());
      }
      this.textIndex.get(word)!.add(document.id);
    });

    // Add to vector index
    this.vectorIndex.push(document);
  }

  // Remove document
  async removeDocument(id: string): Promise<void> {
    const doc = this.documents.get(id);
    if (!doc) return;

    this.documents.delete(id);
    this.vectorIndex = this.vectorIndex.filter(d => d.id !== id);

    // Update text index
    const words = doc.text.toLowerCase().split(/\W+/);
    words.forEach(word => {
      const set = this.textIndex.get(word);
      if (set) {
        set.delete(id);
        if (set.size === 0) {
          this.textIndex.delete(word);
        }
      }
    });
  }

  // Hybrid search: text + semantic
  async search(params: SeekDBQuery): Promise<SeekDBSearchResult> {
    const startTime = Date.now();
    const limit = params.limit || 10;

    // Text search
    const textResults = this.textSearch(params.query, limit);

    // Semantic search
    const semanticResults = this.semanticSearch(params.query, limit);

    // Merge and deduplicate
    const merged = new Map<string, { doc: SeekDBDocument; score: number }>();

    textResults.forEach(result => {
      merged.set(result.id, {
        doc: result,
        score: 0.7, // Text match weight
      });
    });

    semanticResults.forEach(result => {
      if (merged.has(result.id)) {
        merged.get(result.id)!.score += 0.3; // Semantic match weight
      } else {
        merged.set(result.id, {
          doc: result,
          score: 0.3,
        });
      }
    });

    // Apply filters if provided
    let results = Array.from(merged.values());
    if (params.filters) {
      results = results.filter(item => this.matchesFilters(item.doc, params.filters!));
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    const documents = results.slice(0, limit).map(r => {
      r.doc.score = r.score;
      return r.doc;
    });

    const queryTime = Date.now() - startTime;

    return {
      documents,
      totalCount: merged.size,
      queryTime,
    };
  }

  private textSearch(query: string, limit: number): SeekDBDocument[] {
    const queryWords = query.toLowerCase().split(/\W+/);
    const docScores = new Map<string, number>();

    // Find documents matching query words
    queryWords.forEach(word => {
      const docIds = this.textIndex.get(word) || new Set();
      docIds.forEach(id => {
        docScores.set(id, (docScores.get(id) || 0) + 1);
      });
    });

    // Return matching documents sorted by score
    return Array.from(docScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.documents.get(id)!)
      .filter(d => d !== undefined);
  }

  private semanticSearch(query: string, limit: number): SeekDBDocument[] {
    // Simple implementation: character-level similarity
    const queryLower = query.toLowerCase();
    const results = this.vectorIndex
      .map(doc => ({
        doc,
        similarity: this.calculateSimilarity(queryLower, doc.text.toLowerCase()),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(r => r.doc);

    return results;
  }

  private calculateSimilarity(query: string, text: string): number {
    if (query === text) return 1.0;
    if (!query || !text) return 0;

    // Simple character overlap similarity
    const queryChars = new Set(query);
    const textChars = new Set(text);
    const intersection = new Set([...queryChars].filter(c => textChars.has(c)));
    const union = new Set([...queryChars, ...textChars]);

    return intersection.size / union.size;
  }

  private matchesFilters(doc: SeekDBDocument, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (doc.metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  // Knowledge base tools for agents
  async storeAgentKnowledge(
    agentId: string,
    topic: string,
    content: string
  ): Promise<void> {
    const id = `${agentId}-${topic}-${Date.now()}`;
    await this.addDocument({
      id,
      text: content,
      metadata: {
        agentId,
        topic,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async queryAgentKnowledge(agentId: string, query: string): Promise<SeekDBSearchResult> {
    return this.search({
      query,
      limit: 5,
      filters: { agentId },
    });
  }

  // Get all documents for an agent
  async getAgentDocuments(agentId: string): Promise<SeekDBDocument[]> {
    return Array.from(this.documents.values()).filter(
      doc => doc.metadata.agentId === agentId
    );
  }

  // Clear index
  async clear(): Promise<void> {
    this.documents.clear();
    this.textIndex.clear();
    this.vectorIndex = [];
  }

  // Get stats
  getStats(): {
    totalDocuments: number;
    indexedWords: number;
    memoryUsage: string;
  } {
    const documentsSize = JSON.stringify(Array.from(this.documents.values())).length;
    const indexSize = JSON.stringify(Array.from(this.textIndex.entries())).length;
    const totalBytes = documentsSize + indexSize;
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

    return {
      totalDocuments: this.documents.size,
      indexedWords: this.textIndex.size,
      memoryUsage: `${totalMB} MB`,
    };
  }
}

export const seekDBService = new SeekDBService();

export default seekDBService;
