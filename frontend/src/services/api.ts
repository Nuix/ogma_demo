import { GraphData, WitnessStatementRequest, WitnessStatementResponse, Stats } from '../types';

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
const API_BASE = `${BASE_PATH}/api`;

export async function submitWitnessStatement(
  request: WitnessStatementRequest
): Promise<WitnessStatementResponse> {
  const response = await fetch(`${API_BASE}/witness-statement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to submit witness statement');
  }

  return response.json();
}

export async function fetchGraph(): Promise<GraphData> {
  const response = await fetch(`${API_BASE}/graph`);

  if (!response.ok) {
    throw new Error('Failed to fetch graph data');
  }

  return response.json();
}

export async function fetchStats(): Promise<Stats> {
  const response = await fetch(`${API_BASE}/stats`);

  if (!response.ok) {
    throw new Error('Failed to fetch statistics');
  }

  return response.json();
}
