import {
  createNode, createEdge, createSubmission,
  getGraph, findNodeByLabel, updateNodeProperties, pool,
} from './database';
import { formatTimeLabel, reverseGeocode, geocodeAddress, inferIcon, delay } from './geo';

export interface PollEntry {
  time: string;         // ISO 8601 datetime — used as dedup key, required
  location: string;     // plain text address / place name
  activity?: string;    // what he was doing
  associate?: string;   // who/what he was with
}

let pollInProgress = false;

export async function importEntry(entry: PollEntry, io?: any): Promise<boolean> {
  // time is required and acts as the dedup key
  if (!entry.time) return false;

  // Skip if scheduled for the future — treat times as Sydney local (AEST UTC+10)
  if (new Date(entry.time + '+10:00') > new Date()) return false;

  const caseNumber = `POLL-${entry.time}`;

  // Skip if already imported
  const { rows } = await pool.query('SELECT id FROM submissions WHERE case_number = $1', [caseNumber]);
  if (rows.length > 0) return false;

  const targetName = process.env.TARGET_NAME || 'Unknown Person';
  const targetNode = await findNodeByLabel(targetName, 'PERSON');
  if (!targetNode) return false;

  // Location
  const locationLabel = entry.location.trim();
  let locationNode = await findNodeByLabel(locationLabel, 'LOCATION');
  if (!locationNode) {
    const coords = await geocodeAddress(locationLabel);
    locationNode = await createNode({
      type: 'LOCATION',
      label: locationLabel,
      properties: { mentions: 1, icon: '📍', lat: coords?.lat, lng: coords?.lng },
    });
    if (coords) {
      await delay(1500);
      const geo = await reverseGeocode(coords.lat, coords.lng);
      if (geo) await updateNodeProperties(locationNode.id, { suburb: geo.suburb, suburbLat: geo.suburbLat, suburbLng: geo.suburbLng });
      await delay(1500);
    }
  } else if (!locationNode.properties?.suburb && locationNode.properties?.lat) {
    // Node exists but suburb missing from a previous partial import — retry reverse geocode
    const lat = locationNode.properties.lat;
    const lng = locationNode.properties.lng;
    const geo = await reverseGeocode(lat, lng);
    if (geo) await updateNodeProperties(locationNode.id, { suburb: geo.suburb, suburbLat: geo.suburbLat, suburbLng: geo.suburbLng });
    await delay(1500);
  }

  // Activity
  let activityNode = null;
  if (entry.activity?.trim()) {
    const label = entry.activity.trim();
    activityNode = await findNodeByLabel(label, 'ACTIVITY');
    if (!activityNode) {
      activityNode = await createNode({
        type: 'ACTIVITY',
        label,
        properties: { mentions: 1, icon: inferIcon(label) },
      });
    }
  }

  // Associate
  let associateNode = null;
  if (entry.associate?.trim()) {
    const label = entry.associate.trim();
    associateNode = await findNodeByLabel(label, 'ASSOCIATE');
    if (!associateNode) {
      associateNode = await createNode({
        type: 'ASSOCIATE',
        label,
        properties: { mentions: 1, icon: '👤' },
      });
    }
  }

  // Time node
  let timeNode = null;
  if (entry.time?.trim()) {
    const timeLabel = formatTimeLabel(entry.time);
    timeNode = await findNodeByLabel(timeLabel, 'TIME');
    if (!timeNode) {
      timeNode = await createNode({
        type: 'TIME',
        label: timeLabel,
        properties: { mentions: 1, rawTime: entry.time },
      });
    }
  }

  // Edges — use the entry's time as the canonical timestamp so playback ordering is correct
  // Treat entry times as AEST (UTC+10) when converting to UTC for storage
  const ts = entry.time ? new Date(entry.time + '+10:00').toISOString() : new Date().toISOString();
  const edgeProps = { caseNumber, timestamp: ts };

  await createEdge({ source_id: targetNode.id, target_id: locationNode.id, relationship_type: 'SEEN_AT', properties: edgeProps });
  if (activityNode)  await createEdge({ source_id: targetNode.id,   target_id: activityNode.id,  relationship_type: 'DOING',       properties: edgeProps });
  if (associateNode) {
    await createEdge({ source_id: targetNode.id,   target_id: associateNode.id, relationship_type: 'WITH',       properties: edgeProps });
    await createEdge({ source_id: associateNode.id, target_id: locationNode.id, relationship_type: 'SPOTTED_AT', properties: edgeProps });
  }
  if (timeNode) await createEdge({ source_id: locationNode.id, target_id: timeNode.id, relationship_type: 'DURING', properties: edgeProps });

  await createSubmission({
    witness_name: 'Cameron (self-report)',
    raw_statement: [
      `Seen at: ${locationLabel}`,
      entry.activity  ? `Doing: ${entry.activity}`   : null,
      entry.associate ? `With: ${entry.associate}`   : null,
      entry.time      ? `When: ${entry.time}`        : null,
    ].filter(Boolean).join(', '),
    processed_entities: null,
    moderation_status: 'approved',
    case_number: caseNumber,
  });

  return true;
}

export async function pollOnce(io?: any): Promise<{ checked: number; imported: number }> {
  if (pollInProgress) return { checked: 0, imported: 0 };
  pollInProgress = true;
  try { return await _pollOnce(io); } finally { pollInProgress = false; }
}

async function _pollOnce(io?: any): Promise<{ checked: number; imported: number }> {
  const url = process.env.POLL_URL;
  if (!url) return { checked: 0, imported: 0 };

  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'operation-find-cameron/1.0' } });
  if (!res.ok) throw new Error(`Poll URL returned HTTP ${res.status}`);

  const entries: PollEntry[] = await res.json();
  if (!Array.isArray(entries)) throw new Error('Poll URL did not return a JSON array');

  let imported = 0;
  for (const entry of entries) {
    if (!entry.time || !entry.location) { console.warn('Skipping malformed poll entry:', entry); continue; }
    try {
      const added = await importEntry(entry, io);
      if (added) { imported++; await delay(500); }
    } catch (e: any) {
      console.warn(`Skipping entry (time: ${entry.time}, location: ${entry.location}): ${e?.message}`);
    }
  }

  if (imported > 0 && io) {
    const graphData = await getGraph();
    io.to('investigation').emit('graph:updated', { nodes: graphData.nodes, edges: graphData.edges });
    console.log(`Poll: imported ${imported} new entries`);
  }

  // Repair pass: fill in missing suburb data for any location nodes that have lat but no suburb
  const { rows: missingSuburb } = await pool.query(
    `SELECT id, (properties->>'lat')::float as lat, (properties->>'lng')::float as lng
     FROM nodes WHERE type = 'LOCATION'
       AND properties->>'lat' IS NOT NULL AND properties->>'lat' != ''
       AND (properties->>'suburb' IS NULL OR properties->>'suburb' = '')
     LIMIT 5`
  );
  for (const row of missingSuburb) {
    const geo = await reverseGeocode(row.lat, row.lng);
    if (geo) {
      await updateNodeProperties(row.id, { suburb: geo.suburb, suburbLat: geo.suburbLat, suburbLng: geo.suburbLng });
      if (io) {
        const graphData = await getGraph();
        io.to('investigation').emit('graph:updated', { nodes: graphData.nodes, edges: graphData.edges });
      }
    }
    await delay(1500);
  }
  if (missingSuburb.length > 0) console.log(`Poll: repaired suburb for ${missingSuburb.length} location(s)`);

  return { checked: entries.length, imported };
}

export function startPoller(io: any): void {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS || '300000'); // default 5 min
  if (!process.env.POLL_URL) {
    console.log('POLL_URL not set — GitHub polling disabled');
    return;
  }
  console.log(`Poller started — checking every ${intervalMs / 1000}s`);
  // Run immediately on start, then on interval
  pollOnce(io).catch(e => console.error('Initial poll failed:', e));
  setInterval(() => pollOnce(io).catch(e => console.error('Poll failed:', e)), intervalMs);
}
