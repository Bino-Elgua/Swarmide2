// PostgreSQL database service with connection pooling
import { Pool, PoolClient } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number; // Max connections in pool
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export class Database {
  private pool: Pool;
  private connected = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      console.log('✅ Connected to PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('✅ Disconnected from PostgreSQL');
    }
  }

  // Query execution
  async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount || 0 };
    } finally {
      client.release();
    }
  }

  // Single row query
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] || null;
  }

  // Transaction support
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Insert
  async insert<T = any>(table: string, data: Record<string, any>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');

    const sql = `
      INSERT INTO ${table} (${keys.join(',')})
      VALUES (${placeholders})
      RETURNING *
    `;

    return this.queryOne<T>(sql, values) as Promise<T>;
  }

  // Update
  async update<T = any>(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): Promise<T[]> {
    const keys = Object.keys(data);
    const whereKeys = Object.keys(where);
    const values = [...Object.values(data), ...Object.values(where)];

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(',');
    const whereClause = whereKeys
      .map((key, i) => `${key} = $${keys.length + i + 1}`)
      .join(' AND ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;

    const result = await this.query<T>(sql, values);
    return result.rows;
  }

  // Delete
  async delete(table: string, where: Record<string, any>): Promise<number> {
    const whereKeys = Object.keys(where);
    const values = Object.values(where);

    const whereClause = whereKeys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(' AND ');

    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;

    const result = await this.query(sql, values);
    return result.rowCount;
  }

  // Get pool stats
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      connected: this.connected,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Create default database instance
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'swarmide2',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const db = new Database(dbConfig);

export default db;
