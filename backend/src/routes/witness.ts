import { Router } from 'express';
import { formatTimeLabel, reverseGeocode, delay } from '../services/geo';
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

const router = Router();

router.post('/witness-statement', async (req, res) => {
  try {
    const { witnessName, location, locationLat, locationLng, activity, activityIcon, associate, time }: WitnessStatementRequest = req.body;

    if (!location || location.trim().length === 0) {
      return res.status(400).json({
        success: false,
        status: 'rejected',
        message: 'Location is required',
        reason: 'Missing location',
      });
    }

    const caseNumber = await generateCaseNumber();
    const nodeMap = new Map<string, Node>();

    // Target person node
    const targetName = process.env.TARGET_NAME || 'Unknown Person';
    const targetNode = await findNodeByLabel(targetName, 'PERSON');
    if (targetNode) {
      nodeMap.set(targetName, targetNode);
    }

    // Witness node
    const witnessLabel = witnessName?.trim() || 'Anonymous';
    let witnessNode = await findNodeByLabel(witnessLabel, 'WITNESS');
    if (!witnessNode) {
      witnessNode = await createNode({
        type: 'WITNESS',
        label: witnessLabel,
        properties: { caseNumber, submissions: 1 },
      });
    }
    nodeMap.set(witnessLabel, witnessNode);

    // Location node
    const locationLabel = location.trim();
    let locationNode = await findNodeByLabel(locationLabel, 'LOCATION');
    if (!locationNode) {
      locationNode = await createNode({
        type: 'LOCATION',
        label: locationLabel,
        properties: { mentions: 1, icon: '📍', lat: locationLat, lng: locationLng },
      });
      if (locationLat && locationLng) {
        const nodeId = locationNode.id;
        reverseGeocode(locationLat, locationLng).then(geo => {
          if (geo) updateNodeProperties(nodeId, { suburb: geo.suburb, suburbLat: geo.suburbLat, suburbLng: geo.suburbLng });
        }).catch(() => {});
      }
    }
    nodeMap.set(locationLabel, locationNode);

    // Activity node (optional)
    let activityNode: Node | null = null;
    if (activity?.trim()) {
      const activityLabel = activity.trim();
      activityNode = await findNodeByLabel(activityLabel, 'ACTIVITY');
      if (!activityNode) {
        activityNode = await createNode({
          type: 'ACTIVITY',
          label: activityLabel,
          properties: { mentions: 1, icon: activityIcon || '☕' },
        });
      }
      nodeMap.set(activityLabel, activityNode);
    }

    // Associate node (optional — someone/something seen with target)
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
      nodeMap.set(associateLabel, associateNode);
    }

    // Time node (optional)
    let timeNode: Node | null = null;
    if (time?.trim()) {
      // Format datetime-local value (YYYY-MM-DDTHH:MM) into readable label
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
      nodeMap.set(timeLabel, timeNode);
    }

    // Edges
    // witness -> target: REPORTED_SIGHTING_AT
    if (targetNode) {
      await createEdge({
        source_id: witnessNode.id,
        target_id: targetNode.id,
        relationship_type: 'REPORTED_SIGHTING_AT',
        properties: { caseNumber, timestamp: new Date().toISOString() },
      });
    }

    // target -> location: SEEN_AT
    if (targetNode && locationNode) {
      await createEdge({
        source_id: targetNode.id,
        target_id: locationNode.id,
        relationship_type: 'SEEN_AT',
        properties: { caseNumber, timestamp: new Date().toISOString() },
      });
    }

    // target -> activity: DOING
    if (targetNode && activityNode) {
      await createEdge({
        source_id: targetNode.id,
        target_id: activityNode.id,
        relationship_type: 'DOING',
        properties: { caseNumber, timestamp: new Date().toISOString() },
      });
    }

    // target -> associate: WITH
    if (targetNode && associateNode) {
      await createEdge({
        source_id: targetNode.id,
        target_id: associateNode.id,
        relationship_type: 'WITH',
        properties: { caseNumber, timestamp: new Date().toISOString() },
      });
    }

    // associate -> location: SPOTTED_AT (anchors associate to where they were seen)
    if (associateNode && locationNode) {
      await createEdge({
        source_id: associateNode.id,
        target_id: locationNode.id,
        relationship_type: 'SPOTTED_AT',
        properties: { caseNumber, timestamp: new Date().toISOString() },
      });
    }

    // location -> time: DURING
    if (locationNode && timeNode) {
      await createEdge({
        source_id: locationNode.id,
        target_id: timeNode.id,
        relationship_type: 'DURING',
        properties: { caseNumber, timestamp: new Date().toISOString() },
      });
    }

    // Save submission (use location + extras as the raw statement summary)
    const rawStatement = [
      `Seen at: ${locationLabel}`,
      activity ? `Doing: ${activity}` : null,
      associate ? `With: ${associate}` : null,
      time ? `When: ${time}` : null,
    ].filter(Boolean).join(', ');

    await createSubmission({
      witness_name: witnessName,
      raw_statement: rawStatement,
      processed_entities: null,
      moderation_status: 'approved',
      case_number: caseNumber,
    });

    // Broadcast update via WebSocket
    const io = req.app.get('io');
    if (io) {
      const graphData = await getGraph();
      io.to('investigation').emit('graph:updated', {
        nodes: graphData.nodes.slice(-10),
        edges: graphData.edges.slice(-10),
      });
    }

    const response: WitnessStatementResponse = {
      success: true,
      caseNumber,
      status: 'approved',
      message: `Sighting filed${witnessName ? ', Investigator ' + witnessName : ''}! Case #${caseNumber}`,
      badge: {
        name: witnessLabel,
        caseNumber,
        timestamp: new Date().toISOString(),
      },
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
