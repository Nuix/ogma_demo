import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { Node, Edge, WitnessSubmission, GraphData, Stats } from '../types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        label VARCHAR(255) NOT NULL,
        properties JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        target_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        relationship_type VARCHAR(100) NOT NULL,
        properties JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        witness_name VARCHAR(255),
        raw_statement TEXT NOT NULL,
        processed_entities JSONB,
        moderation_status VARCHAR(20) DEFAULT 'pending',
        case_number VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(moderation_status);
    `);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function createNode(node: Omit<Node, 'id' | 'created_at'>): Promise<Node> {
  const id = uuidv4();
  const result = await pool.query(
    'INSERT INTO nodes (id, type, label, properties) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, node.type, node.label, JSON.stringify(node.properties || {})]
  );
  return result.rows[0];
}

export async function updateNodeProperties(id: string, properties: Record<string, any>): Promise<void> {
  await pool.query(
    'UPDATE nodes SET properties = properties || $1::jsonb WHERE id = $2',
    [JSON.stringify(properties), id]
  );
}

export async function findNodeByLabel(label: string, type?: string): Promise<Node | null> {
  const query = type
    ? 'SELECT * FROM nodes WHERE label = $1 AND type = $2 LIMIT 1'
    : 'SELECT * FROM nodes WHERE label = $1 LIMIT 1';
  const params = type ? [label, type] : [label];
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function createEdge(edge: Omit<Edge, 'id' | 'created_at'>): Promise<Edge> {
  const id = uuidv4();
  const result = await pool.query(
    'INSERT INTO edges (id, source_id, target_id, relationship_type, properties) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [id, edge.source_id, edge.target_id, edge.relationship_type, JSON.stringify(edge.properties || {})]
  );
  return result.rows[0];
}

export async function createSubmission(
  submission: Omit<WitnessSubmission, 'id' | 'created_at'>
): Promise<WitnessSubmission> {
  const id = uuidv4();
  const result = await pool.query(
    'INSERT INTO submissions (id, witness_name, raw_statement, processed_entities, moderation_status, case_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [
      id,
      submission.witness_name,
      submission.raw_statement,
      JSON.stringify(submission.processed_entities),
      submission.moderation_status,
      submission.case_number,
    ]
  );
  return result.rows[0];
}

export async function getGraph(): Promise<GraphData> {
  const nodesResult = await pool.query('SELECT * FROM nodes ORDER BY created_at ASC');
  const edgesResult = await pool.query('SELECT * FROM edges ORDER BY created_at ASC');

  return {
    nodes: nodesResult.rows,
    edges: edgesResult.rows.map(edge => ({
      id: edge.id,
      source: edge.source_id,
      target: edge.target_id,
      type: edge.relationship_type,
      properties: edge.properties,
      created_at: edge.created_at,
    })),
  };
}

export async function getStats(): Promise<Stats> {
  const witnessCountResult = await pool.query(
    "SELECT COUNT(DISTINCT id) as count FROM nodes WHERE type = 'WITNESS'"
  );
  const sightingCountResult = await pool.query('SELECT COUNT(*) as count FROM submissions WHERE moderation_status = $1', ['approved']);

  const topLocationsResult = await pool.query(
    "SELECT label, COUNT(*) as count FROM nodes WHERE type = 'LOCATION' GROUP BY label ORDER BY count DESC LIMIT 5"
  );

  const topWitnessesResult = await pool.query(
    "SELECT label as name, properties->>'submissions' as submissions FROM nodes WHERE type = 'WITNESS' ORDER BY (properties->>'submissions')::int DESC LIMIT 5"
  );

  return {
    totalWitnesses: parseInt(witnessCountResult.rows[0]?.count || '0'),
    totalSightings: parseInt(sightingCountResult.rows[0]?.count || '0'),
    topLocations: topLocationsResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
    topWitnesses: topWitnessesResult.rows.map(r => ({ name: r.name, submissions: parseInt(r.submissions || '0') })),
  };
}

export async function generateCaseNumber(): Promise<string> {
  const result = await pool.query('SELECT COUNT(*) as count FROM submissions');
  const count = parseInt(result.rows[0].count) + parseInt(process.env.CASE_START_NUMBER || '1000');
  return `CASE-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
}

export { pool };
