import { Router } from 'express';
import { formatTimeLabel, reverseGeocode, geocodeAddress, inferIcon, normalizeAddress } from '../services/geo';
import { pollOnce } from '../services/poller';
import {
  createNode,
  createEdge,
  createSubmission,
  getGraph,
  getStats,
  generateCaseNumber,
  findNodeByLabel,
  updateNodeProperties,
  pool,
} from '../services/database';

import { WitnessStatementRequest, WitnessStatementResponse, Node } from '../types';
// Node is used as a type annotation below

const router = Router();

router.post('/witness-statement', async (req, res) => {
  try {
    const { location, activity, associate, time }: WitnessStatementRequest = req.body;

    if (!location || location.trim().length === 0) {
      return res.status(400).json({
        success: false,
        status: 'rejected',
        message: 'Location is required',
        reason: 'Missing location',
      });
    }

    const caseNumber = await generateCaseNumber();

    // Target person node
    const targetName = process.env.TARGET_NAME || 'Unknown Person';
    const targetNode = await findNodeByLabel(targetName, 'PERSON');

    // Location node — normalise then find/create with coord-proximity dedup
    const locationLabel = normalizeAddress(location);
    let locationNode = await findNodeByLabel(locationLabel, 'LOCATION');
    if (!locationNode) {
      const coords = await geocodeAddress(locationLabel);
      // Reuse any existing node within ~50 m (±0.0005°) rather than creating a duplicate
      if (coords) {
        const { rows: nearby } = await pool.query(
          `SELECT * FROM nodes WHERE type = 'LOCATION'
             AND ABS((properties->>'lat')::float - $1) < 0.0005
             AND ABS((properties->>'lng')::float - $2) < 0.0005
           LIMIT 1`,
          [coords.lat, coords.lng],
        );
        if (nearby.length > 0) locationNode = nearby[0];
      }
      if (!locationNode) {
        locationNode = await createNode({
          type: 'LOCATION',
          label: locationLabel,
          properties: { mentions: 1, icon: '📍', lat: coords?.lat, lng: coords?.lng },
        });
        if (coords) {
          const nodeId = locationNode.id;
          reverseGeocode(coords.lat, coords.lng).then(geo => {
            if (geo) updateNodeProperties(nodeId, { suburb: geo.suburb, suburbLat: geo.suburbLat, suburbLng: geo.suburbLng });
          }).catch(() => {});
        }
      }
    }

    // Activity node (optional)
    let activityNode: Node | null = null;
    if (activity?.trim()) {
      const activityLabel = activity.trim();
      activityNode = await findNodeByLabel(activityLabel, 'ACTIVITY');
      if (!activityNode) {
        activityNode = await createNode({
          type: 'ACTIVITY',
          label: activityLabel,
          properties: { mentions: 1, icon: inferIcon(activityLabel) },
        });
      }
    }

    // Associate node (optional)
    let associateNode: Node | null = null;
    if (associate?.trim()) {
      const associateLabel = associate.trim();
      associateNode = await findNodeByLabel(associateLabel, 'ASSOCIATE');
      if (!associateNode) {
        associateNode = await createNode({
          type: 'ASSOCIATE',
          label: associateLabel,
          properties: { mentions: 1, icon: '👤' },
        });
      }
    }

    // Time node (optional)
    let timeNode: Node | null = null;
    if (time?.trim()) {
      const rawTime = time.trim();
      const timeLabel = formatTimeLabel(rawTime);
      timeNode = await findNodeByLabel(timeLabel, 'TIME');
      if (!timeNode) {
        timeNode = await createNode({
          type: 'TIME',
          label: timeLabel,
          properties: { mentions: 1, rawTime },
        });
      }
    }

    const ts = time?.trim() ? new Date(time.trim()).toISOString() : new Date().toISOString();
    const edgeProps = { caseNumber, timestamp: ts };

    if (targetNode) {
      await createEdge({ source_id: targetNode.id, target_id: locationNode.id, relationship_type: 'SEEN_AT', properties: edgeProps });
      if (activityNode) {
        await createEdge({ source_id: locationNode.id, target_id: activityNode.id, relationship_type: 'HAS_ACTIVITY', properties: edgeProps });
        if (associateNode) await createEdge({ source_id: activityNode.id, target_id: associateNode.id, relationship_type: 'WITH', properties: edgeProps });
      } else if (associateNode) {
        await createEdge({ source_id: locationNode.id, target_id: associateNode.id, relationship_type: 'WITH', properties: edgeProps });
      }
    }
    if (timeNode) await createEdge({ source_id: locationNode.id, target_id: timeNode.id, relationship_type: 'DURING', properties: edgeProps });

    const rawStatement = [
      `Seen at: ${locationLabel}`,
      activity ? `Doing: ${activity}` : null,
      associate ? `With: ${associate}` : null,
      time ? `When: ${time}` : null,
    ].filter(Boolean).join(', ');

    await createSubmission({
      witness_name: 'Staff submission',
      raw_statement: rawStatement,
      processed_entities: null,
      moderation_status: 'approved',
      case_number: caseNumber,
    });

    const io = req.app.get('io');
    if (io) {
      const graphData = await getGraph();
      io.to('investigation').emit('graph:updated', { nodes: graphData.nodes, edges: graphData.edges });
    }

    const response: WitnessStatementResponse = {
      success: true,
      caseNumber,
      status: 'approved',
      message: `Sighting filed! Case #${caseNumber}`,
    };

    res.json(response);
  } catch (error) {
    console.error('Error processing witness statement:', error);
    res.status(500).json({
      success: false,
      status: 'rejected',
      message: 'An error occurred processing your statement',
      reason: 'Internal server error',
    } as WitnessStatementResponse);
  }
});

router.delete('/purge', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM submissions');
      await client.query('DELETE FROM edges');
      await client.query('DELETE FROM nodes');
    } finally {
      client.release();
    }
    const targetName = process.env.TARGET_NAME || 'Unknown Person';
    const lastSeen = process.env.LAST_SEEN_DATE || '';
    await createNode({ type: 'PERSON', label: targetName, properties: { status: 'MISSING', lastSeen } });
    const io = req.app.get('io');
    if (io) {
      const graphData = await getGraph();
      io.to('investigation').emit('graph:updated', { nodes: graphData.nodes, edges: graphData.edges });
    }
    res.json({ success: true, message: 'All data purged' });
  } catch (error) {
    console.error('Error purging data:', error);
    res.status(500).json({ success: false, message: 'Purge failed' });
  }
});

router.post('/patch-suburbs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, properties FROM nodes WHERE type = 'LOCATION'
       AND (properties->>'lat') IS NOT NULL
       AND (properties->>'suburb') IS NULL`
    );
    const rows = result.rows;
    res.json({ message: `Patching ${rows.length} locations…`, count: rows.length });
    // Run after response sent
    (async () => {
      for (const row of rows) {
        const lat = parseFloat(row.properties.lat);
        const lng = parseFloat(row.properties.lng);
        const geo = await reverseGeocode(lat, lng);
        if (geo) await updateNodeProperties(row.id, { suburb: geo.suburb, suburbLat: geo.suburbLat, suburbLng: geo.suburbLng });
        await new Promise(r => setTimeout(r, 1100)); // Nominatim: 1 req/sec
      }
      console.log(`Suburb patch complete for ${rows.length} nodes`);
    })();
  } catch (error) {
    console.error('Patch error:', error);
    res.status(500).json({ error: 'Patch failed' });
  }
});

router.get('/graph', async (req, res) => {
  try {
    const graphData = await getGraph();
    res.json(graphData);
  } catch (error) {
    console.error('Error fetching graph:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.post('/poll', async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await pollOnce(io);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Manual poll error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Poll failed' });
  }
});

export default router;
