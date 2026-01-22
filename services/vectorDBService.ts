import axios from 'axios';

export interface VectorRecord {
  id: string;
  vector: number[];
  payload: Record<string, any>;
  score?: number;
}

export interface VectorSearchRequest {
  query: number[];
  limit?: number;
  filters?: Record<string, any>;
}

export type VectorDBType = 'qdrant' | 'milvus' | 'pinecone';

class VectorDBService {
  private dbType: VectorDBType = 'qdrant';
  private baseUrl: string;
  private apiKey?: string;
  private collectionName: string = 'swarmide2';

  constructor(
    dbType: VectorDBType = 'qdrant',
    baseUrl?: string,
    apiKey?: string
  ) {
    this.dbType = dbType;
    this.baseUrl = baseUrl || this.getDefaultBaseUrl();
    this.apiKey = apiKey || process.env.VECTOR_DB_API_KEY;
  }

  private getDefaultBaseUrl(): string {
    switch (this.dbType) {
      case 'qdrant':
        return process.env.QDRANT_URL || 'http://localhost:6333';
      case 'milvus':
        return process.env.MILVUS_URL || 'http://localhost:19530';
      case 'pinecone':
        return 'https://api.pinecone.io';
      default:
        return 'http://localhost:6333';
    }
  }

  // Initialize collection/index
  async initialize(): Promise<void> {
    switch (this.dbType) {
      case 'qdrant':
        await this.initializeQdrant();
        break;
      case 'milvus':
        await this.initializeMilvus();
        break;
      case 'pinecone':
        await this.initializePinecone();
        break;
    }
  }

  private async initializeQdrant(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/collections/${this.collectionName}`);
      if (!response.data.result) {
        // Create collection
        await axios.put(`${this.baseUrl}/collections/${this.collectionName}`, {
          vectors: {
            size: 1536, // Default embedding size
            distance: 'Cosine',
          },
        });
      }
    } catch (error) {
      console.log('Creating Qdrant collection...');
      try {
        await axios.put(`${this.baseUrl}/collections/${this.collectionName}`, {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        });
      } catch (e) {
        console.error('Failed to initialize Qdrant:', e);
      }
    }
  }

  private async initializeMilvus(): Promise<void> {
    // Milvus initialization
    console.log('Milvus initialization not fully implemented');
  }

  private async initializePinecone(): Promise<void> {
    // Pinecone initialization
    console.log('Pinecone initialization not fully implemented');
  }

  // Upsert vectors
  async upsertVectors(records: VectorRecord[]): Promise<void> {
    switch (this.dbType) {
      case 'qdrant':
        await this.upsertQdrant(records);
        break;
      case 'milvus':
        await this.upsertMilvus(records);
        break;
      case 'pinecone':
        await this.upsertPinecone(records);
        break;
    }
  }

  private async upsertQdrant(records: VectorRecord[]): Promise<void> {
    try {
      const points = records.map(r => ({
        id: this.hashId(r.id),
        vector: r.vector,
        payload: r.payload,
      }));

      await axios.put(
        `${this.baseUrl}/collections/${this.collectionName}/points`,
        { points },
        {
          headers: this.getHeaders(),
        }
      );
    } catch (error) {
      console.error('Failed to upsert to Qdrant:', error);
      throw error;
    }
  }

  private async upsertMilvus(records: VectorRecord[]): Promise<void> {
    // Milvus upsert implementation
    console.log('Milvus upsert not fully implemented');
  }

  private async upsertPinecone(records: VectorRecord[]): Promise<void> {
    // Pinecone upsert implementation
    console.log('Pinecone upsert not fully implemented');
  }

  // Search vectors
  async searchVectors(request: VectorSearchRequest): Promise<VectorRecord[]> {
    switch (this.dbType) {
      case 'qdrant':
        return this.searchQdrant(request);
      case 'milvus':
        return this.searchMilvus(request);
      case 'pinecone':
        return this.searchPinecone(request);
      default:
        return [];
    }
  }

  private async searchQdrant(request: VectorSearchRequest): Promise<VectorRecord[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collectionName}/points/search`,
        {
          vector: request.query,
          limit: request.limit || 10,
          with_payload: true,
        },
        {
          headers: this.getHeaders(),
        }
      );

      return (response.data.result || []).map((item: any) => ({
        id: item.id,
        vector: [],
        payload: item.payload,
        score: item.score,
      }));
    } catch (error) {
      console.error('Failed to search Qdrant:', error);
      return [];
    }
  }

  private async searchMilvus(request: VectorSearchRequest): Promise<VectorRecord[]> {
    // Milvus search implementation
    console.log('Milvus search not fully implemented');
    return [];
  }

  private async searchPinecone(request: VectorSearchRequest): Promise<VectorRecord[]> {
    // Pinecone search implementation
    console.log('Pinecone search not fully implemented');
    return [];
  }

  // Delete vectors
  async deleteVectors(ids: string[]): Promise<void> {
    switch (this.dbType) {
      case 'qdrant':
        await this.deleteQdrant(ids);
        break;
      case 'milvus':
        await this.deleteMilvus(ids);
        break;
      case 'pinecone':
        await this.deletePinecone(ids);
        break;
    }
  }

  private async deleteQdrant(ids: string[]): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/collections/${this.collectionName}/points/delete`,
        {
          points: ids.map(id => this.hashId(id)),
        },
        {
          headers: this.getHeaders(),
        }
      );
    } catch (error) {
      console.error('Failed to delete from Qdrant:', error);
    }
  }

  private async deleteMilvus(ids: string[]): Promise<void> {
    // Milvus delete implementation
    console.log('Milvus delete not fully implemented');
  }

  private async deletePinecone(ids: string[]): Promise<void> {
    // Pinecone delete implementation
    console.log('Pinecone delete not fully implemented');
  }

  // Utility methods
  private hashId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  // Store agent outputs as vectors
  async storeAgentOutput(
    agentId: string,
    phase: number,
    output: string,
    embedding: number[]
  ): Promise<void> {
    const record: VectorRecord = {
      id: `${agentId}-${phase}-${Date.now()}`,
      vector: embedding,
      payload: {
        agentId,
        phase,
        output,
        timestamp: new Date().toISOString(),
      },
    };

    await this.upsertVectors([record]);
  }

  // Retrieve similar agent outputs
  async getSimilarOutputs(query: number[], agentId?: string, limit: number = 5): Promise<VectorRecord[]> {
    const results = await this.searchVectors({
      query,
      limit,
    });

    if (agentId) {
      return results.filter(r => r.payload.agentId === agentId);
    }

    return results;
  }

  // Get health status
  async health(): Promise<{ status: string; dbType: VectorDBType }> {
    try {
      switch (this.dbType) {
        case 'qdrant':
          await axios.get(`${this.baseUrl}/health`);
          return { status: 'healthy', dbType: this.dbType };
        case 'milvus':
          // Milvus health check
          return { status: 'unknown', dbType: this.dbType };
        case 'pinecone':
          // Pinecone health check
          return { status: 'unknown', dbType: this.dbType };
      }
    } catch (error) {
      return { status: 'unhealthy', dbType: this.dbType };
    }
  }

  setDbType(dbType: VectorDBType): void {
    this.dbType = dbType;
    this.baseUrl = this.getDefaultBaseUrl();
  }
}

export const vectorDBService = new VectorDBService();

export default vectorDBService;
