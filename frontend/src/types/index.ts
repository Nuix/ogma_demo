export type NodeType = 'PERSON' | 'LOCATION' | 'ACTIVITY' | 'WITNESS' | 'TIME' | 'ASSOCIATE';

export type RelationshipType =
  | 'REPORTED_SIGHTING_AT'
  | 'SEEN_AT'
  | 'DOING'
  | 'WITH'
  | 'DURING'
  | 'LOCATED_IN'
  | 'SPOTTED_AT';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  properties?: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
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

export interface Stats {
  totalWitnesses: number;
  totalSightings: number;
  topLocations: Array<{ label: string; count: number }>;
  topWitnesses: Array<{ name: string; submissions: number }>;
}
