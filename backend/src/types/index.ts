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
  processed_entities?: ClaudeEntityResponse | null;
  moderation_status: 'pending' | 'approved' | 'rejected';
  case_number: string;
  created_at?: Date;
}

export interface ClaudeEntity {
  type: NodeType;
  label: string;
}

export interface ClaudeRelationship {
  from: string;
  to: string;
  type: RelationshipType;
}

export interface ClaudeEntityResponse {
  approved: boolean;
  reason?: string;
  entities: ClaudeEntity[];
  relationships: ClaudeRelationship[];
  caseReport: string;
}

export interface WitnessStatementRequest {
  witnessName?: string;
  location: string;
  locationLat?: number;
  locationLng?: number;
  activity?: string;
  activityIcon?: string;
  associate?: string;
  time?: string;
}

export interface WitnessStatementResponse {
  success: boolean;
  caseNumber?: string;
  status: 'approved' | 'rejected';
  message: string;
  badge?: {
    name: string;
    caseNumber: string;
    timestamp: string;
  };
  extractedEntities?: ClaudeEntity[];
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
