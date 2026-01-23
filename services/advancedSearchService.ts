// Advanced Search Service (Elasticsearch-style)
export interface SearchIndex {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: number;
  score?: number;
}

export interface SearchQuery {
  q: string;
  filters?: Record<string, any>;
  from?: number;
  size?: number;
  sort?: Record<string, 'asc' | 'desc'>;
}

export interface SearchResult {
  total: number;
  results: SearchIndex[];
  facets?: Record<string, Record<string, number>>;
  suggestions?: string[];
  timeMs: number;
}

export class AdvancedSearchEngine {
  private indices: Map<string, SearchIndex> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // word -> document ids
  private typeIndices: Map<string, Set<string>> = new Map(); // type -> document ids
  private cachedQueries: Map<string, SearchResult> = new Map();
  private spellDictionary: Set<string> = new Set();
  private synonyms: Map<string, string[]> = new Map();
  private maxCachedQueries = 1000;

  constructor() {
    this.initializeSpellDictionary();
    this.initializeSynonyms();
  }

  // Index document
  indexDocument(id: string, type: string, content: string, metadata?: Record<string, any>): void {
    const doc: SearchIndex = {
      id,
      type,
      content,
      metadata: metadata || {},
      timestamp: Date.now(),
    };

    this.indices.set(id, doc);

    // Build inverted index
    const tokens = this.tokenize(content);
    tokens.forEach(token => {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(id);
    });

    // Index by type
    if (!this.typeIndices.has(type)) {
      this.typeIndices.set(type, new Set());
    }
    this.typeIndices.get(type)!.add(id);

    // Add words to spell dictionary
    tokens.forEach(token => this.spellDictionary.add(token));
  }

  // Search
  search(query: SearchQuery): SearchResult {
    const startTime = Date.now();

    // Check cache
    const cacheKey = JSON.stringify(query);
    const cached = this.cachedQueries.get(cacheKey);
    if (cached) {
      console.log(`✓ Search cache hit: "${query.q}"`);
      return { ...cached, timeMs: Date.now() - startTime };
    }

    // Parse query
    const tokens = this.tokenize(query.q);
    let resultIds = new Set<string>();

    // Full-text search
    if (tokens.length > 0) {
      const firstToken = tokens[0];
      const docIds = this.invertedIndex.get(firstToken);

      if (docIds) {
        // Start with docs containing first token
        resultIds = new Set(docIds);

        // Intersect with other tokens
        for (let i = 1; i < tokens.length; i++) {
          const tokenDocs = this.invertedIndex.get(tokens[i]);
          if (tokenDocs) {
            resultIds = new Set([...resultIds].filter(id => tokenDocs.has(id)));
          } else {
            resultIds.clear();
            break;
          }
        }
      }

      // Spell correction
      const correctedTokens = tokens.map(t => this.correctSpelling(t));
      if (correctedTokens.some((t, i) => t !== tokens[i])) {
        const correctedQuery = correctedTokens.join(' ');
        console.log(`📝 Did you mean: "${correctedQuery}"`);
      }
    }

    // Apply filters
    if (query.filters) {
      resultIds = new Set(
        [...resultIds].filter(id => {
          const doc = this.indices.get(id);
          return doc && this.matchesFilters(doc, query.filters!);
        })
      );
    }

    // Collect results
    let results = Array.from(resultIds)
      .map(id => this.indices.get(id)!)
      .filter(doc => doc !== undefined);

    // Score results
    results = results.map(doc => ({
      ...doc,
      score: this.scoreDocument(doc, tokens),
    }));

    // Sort
    if (query.sort) {
      for (const [field, order] of Object.entries(query.sort)) {
        results.sort((a, b) => {
          const aVal = a.metadata[field] || 0;
          const bVal = b.metadata[field] || 0;
          return order === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }
    } else {
      // Default: sort by score
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    // Pagination
    const from = query.from || 0;
    const size = query.size || 10;
    const paginated = results.slice(from, from + size);

    // Generate facets
    const facets = this.generateFacets(results, query.filters);

    // Generate suggestions
    const suggestions = this.generateSuggestions(query.q);

    const result: SearchResult = {
      total: results.length,
      results: paginated,
      facets,
      suggestions,
      timeMs: Date.now() - startTime,
    };

    // Cache result
    if (this.cachedQueries.size >= this.maxCachedQueries) {
      const firstKey = this.cachedQueries.keys().next().value;
      this.cachedQueries.delete(firstKey);
    }
    this.cachedQueries.set(cacheKey, result);

    return result;
  }

  // Faceted search
  facetedSearch(query: SearchQuery, facetField: string): Record<string, number> {
    const results = this.search(query).results;

    return results.reduce((acc, doc) => {
      const value = doc.metadata[facetField];
      if (value) {
        acc[value] = (acc[value] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  // Autocomplete
  autocomplete(prefix: string, limit = 10): string[] {
    const suggestions = Array.from(this.spellDictionary)
      .filter(word => word.startsWith(prefix.toLowerCase()))
      .sort()
      .slice(0, limit);

    return suggestions;
  }

  // Get document
  getDocument(id: string): SearchIndex | undefined {
    return this.indices.get(id);
  }

  // Delete document
  deleteDocument(id: string): boolean {
    const doc = this.indices.get(id);
    if (!doc) return false;

    // Remove from indices
    const tokens = this.tokenize(doc.content);
    tokens.forEach(token => {
      const docs = this.invertedIndex.get(token);
      if (docs) docs.delete(id);
    });

    const typeDocs = this.typeIndices.get(doc.type);
    if (typeDocs) typeDocs.delete(id);

    this.indices.delete(id);
    return true;
  }

  // Get statistics
  getStats(): any {
    return {
      totalDocuments: this.indices.size,
      totalIndexedTerms: this.invertedIndex.size,
      totalTypes: this.typeIndices.size,
      cachedQueries: this.cachedQueries.size,
      dictionarySize: this.spellDictionary.size,
      synonyms: this.synonyms.size,
    };
  }

  // Clear cache
  clearCache(): void {
    this.cachedQueries.clear();
  }

  // Private methods
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  private scoreDocument(doc: SearchIndex, tokens: string[]): number {
    let score = 0;
    const content = doc.content.toLowerCase();

    tokens.forEach(token => {
      // Exact matches score higher
      if (content.includes(token)) {
        score += 10;
      }

      // Title matches score highest
      if (doc.metadata.title?.toLowerCase().includes(token)) {
        score += 20;
      }
    });

    // Boost recent documents
    const ageMs = Date.now() - doc.timestamp;
    const ageBoost = Math.max(0, 10 - ageMs / (30 * 24 * 60 * 60 * 1000)); // Boost for 30 days
    score += ageBoost;

    return score;
  }

  private matchesFilters(doc: SearchIndex, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (doc.metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private generateFacets(results: SearchIndex[], filters?: Record<string, any>): Record<string, Record<string, number>> {
    const facets: Record<string, Record<string, number>> = {};

    results.forEach(doc => {
      for (const [key, value] of Object.entries(doc.metadata)) {
        if (!facets[key]) facets[key] = {};
        facets[key][value] = (facets[key][value] || 0) + 1;
      }
    });

    return facets;
  }

  private generateSuggestions(query: string): string[] {
    const tokens = this.tokenize(query);
    const suggestions: string[] = [];

    tokens.forEach(token => {
      const corrected = this.correctSpelling(token);
      if (corrected !== token) {
        suggestions.push(corrected);
      }

      const synonyms = this.synonyms.get(token) || [];
      suggestions.push(...synonyms.slice(0, 2));
    });

    return [...new Set(suggestions)].slice(0, 5);
  }

  private correctSpelling(word: string): string {
    // Simple correction: find closest match
    if (this.spellDictionary.has(word)) return word;

    let closest = word;
    let minDistance = Infinity;

    for (const dictWord of this.spellDictionary) {
      const distance = this.levenshteinDistance(word, dictWord);
      if (distance < minDistance && distance <= 2) {
        minDistance = distance;
        closest = dictWord;
      }
    }

    return closest;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[b.length][a.length];
  }

  private initializeSpellDictionary(): void {
    // Initialize with common words
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'query', 'search', 'find', 'filter', 'sort', 'index', 'document'
    ];
    commonWords.forEach(word => this.spellDictionary.add(word));
  }

  private initializeSynonyms(): void {
    // Initialize with common synonyms
    this.synonyms.set('search', ['query', 'find', 'lookup']);
    this.synonyms.set('filter', ['refine', 'narrow', 'reduce']);
    this.synonyms.set('sort', ['order', 'arrange', 'organize']);
    this.synonyms.set('index', ['catalog', 'list', 'directory']);
  }
}

export const advancedSearchEngine = new AdvancedSearchEngine();

export default advancedSearchEngine;
