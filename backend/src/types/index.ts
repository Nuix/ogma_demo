export type NodeType = 'PERSON' | 'LOCATION' | 'ACTIVITY' | 'WITNESS' | 'TIME' | 'ASSOCIATE';

export type RelationshipType =
  | 'REPORTED_SIGHTING_AT'
  | 'SEEN_AT'
  | 'DOING'
  | 'WITH'
  | 'DURING'
  | 'LOCATED_IN'
  | 'SPOTTED_AT';

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  properties?: Record<string, any>;
  created_at?: Date;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: RelationshipType;
  properties?: Record<string, any>;
  created_at?: Date;
}

export interface WitnessSubmission {
  id: string;
  witness_name?: string;
  raw_statement: string;
  processed_entities?: null;
  moderation_status: 'pending' | 'approved' | 'rejected';
  case_number: string;
  created_at?: Date;
}

export interface WitnessStatementRequest {
  location: string;
  activity?: string;
  associate?: string;
  time?: string;
}

export interface WitnessStatementResponse {
  success: boolean;
  caseNumber?: string;
  status: 'approved' | 'rejected';
  message: string;
  reason?: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface Stats {
  totalWitnesses: number;
  totalSightings: number;
  topLocations: Array<{ label: string; count: number }>;
  topWitnesses: Array<{ name: string; submissions: number }>;
}
