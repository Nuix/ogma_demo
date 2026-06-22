import { useEffect, useRef } from 'react';
import { GraphData, GraphNode, GraphEdge } from '../types';
import Ogma from '@linkurious/ogma';

interface GraphVisualizationProps {
  data: GraphData;
  visibleNodeIds?: Set<string> | null;
  visibleEdgeIds?: Set<string> | null;
}

function applyVisibility(ogma: any, visibleNodeIds: Set<string> | null | undefined, visibleEdgeIds: Set<string> | null | undefined) {
  if (!visibleNodeIds) {
    ogma.getNodes().setAttributes({ opacity: 1 });
    ogma.getEdges().setAttributes({ opacity: 1 });
  } else {
    const edgeSet = visibleEdgeIds ?? new Set<string>();
    ogma.getNodes().forEach((n: any) => n.setAttributes({ opacity: visibleNodeIds.has(n.getId()) ? 1 : 0.07 }));
    ogma.getEdges().forEach((e: any) => e.setAttributes({ opacity: edgeSet.has(e.getId()) ? 1 : 0 }));
  }
}

const NODE_COLORS: Record<string, string> = {
  PERSON:    '#e74c3c',
  ASSOCIATE: '#f59e0b',
  WITNESS:   '#3b82f6',
  LOCATION:  '#06b6d4',
  ACTIVITY:  '#8b5cf6',
  TIME:      '#f97316',
};

const NODE_ICONS: Record<string, string> = {
  WITNESS:  '👁️',
  LOCATION: '📍',
  TIME:     '🕐',
  ASSOCIATE:'👤',
};

function emojiDataUrl(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><text x="20" y="28" font-size="22" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const TEXT_BASE = { position: 'bottom' as const, color: '#1e293b', size: 11, padding: 3 };

function applyStyles(ogma: any) {
  // All nodes: circle by default
  ogma.styles.addNodeRule(() => true, {
    shape: 'circle',
  });

  // PERSON (target) — large red circle
  ogma.styles.addNodeRule(
    (n: any) => n.getData('type') === 'PERSON',
    {
      radius: 34,
      color: NODE_COLORS.PERSON,
      text: { content: (n: any) => n.getData('label') || '', ...TEXT_BASE, color: '#e74c3c', size: 14 },
    }
  );

  // WITNESS
  ogma.styles.addNodeRule(
    (n: any) => n.getData('type') === 'WITNESS',
    {
      radius: 22,
      color: NODE_COLORS.WITNESS,
      text: { content: (n: any) => n.getData('label') || '', ...TEXT_BASE },
    }
  );

  // LOCATION
  ogma.styles.addNodeRule(
    (n: any) => n.getData('type') === 'LOCATION',
    {
      radius: 22,
      color: NODE_COLORS.LOCATION,
      text: { content: (n: any) => n.getData('label') || '', ...TEXT_BASE },
    }
  );

  // ACTIVITY
  ogma.styles.addNodeRule(
    (n: any) => n.getData('type') === 'ACTIVITY',
    {
      radius: 22,
      color: NODE_COLORS.ACTIVITY,
      text: { content: (n: any) => n.getData('label') || '', ...TEXT_BASE },
    }
  );

  // ASSOCIATE
  ogma.styles.addNodeRule(
    (n: any) => n.getData('type') === 'ASSOCIATE',
    {
      radius: 22,
      color: NODE_COLORS.ASSOCIATE,
      text: { content: (n: any) => n.getData('label') || '', ...TEXT_BASE },
    }
  );

  // Edges — neutral grey arrows
  ogma.styles.addEdgeRule(() => ({
    color: '#94a3b8',
    width: 1.5,
    shape: { head: 'arrow' },
  }));
}

function applyNodeImages(ogma: any) {
  ogma.getNodes().forEach((n: any) => {
    const type: string = n.getData('type') || '';
    let emoji: string | null = null;

    if (type === 'PERSON') {
      emoji = '🎯';
      n.setAttributes({
        image: { url: emojiDataUrl(emoji), scale: 0.65, fit: false },
      });
      return;
    } else if (NODE_ICONS[type]) {
      emoji = NODE_ICONS[type];
    } else if (type === 'ACTIVITY') {
      emoji = n.getData('icon') || '⚡';
    }

    if (emoji) {
      n.setAttributes({
        image: { url: emojiDataUrl(emoji), scale: 0.65, fit: false },
      });
    }
  });
}

export function GraphVisualization({ data, visibleNodeIds = null, visibleEdgeIds = null }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ogmaRef      = useRef<any>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);

  // Init Ogma once
  useEffect(() => {
    if (!containerRef.current) return;
    const ogma = new Ogma({
      container: containerRef.current,
      options: { backgroundColor: '#f0f2f5', interactions: { zoom: { modifier: null } } },
    });
    applyStyles(ogma);

    // Hover tooltips
    ogma.events.on('mouseover', ({ target }: any) => {
      if (!target || target.isVirtual?.() || !tooltipRef.current) return;
      const label = target.getData?.('label');
      if (!label) return;
      tooltipRef.current.textContent = label;
      tooltipRef.current.style.display = 'block';
    });
    ogma.events.on('mouseout', () => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    });
    ogma.events.on('mousemove', (e: any) => {
      if (!tooltipRef.current || tooltipRef.current.style.display === 'none') return;
      const rect = containerRef.current!.getBoundingClientRect();
      tooltipRef.current.style.left = (e.domX - rect.left + 14) + 'px';
      tooltipRef.current.style.top  = (e.domY - rect.top  - 10) + 'px';
    });

    ogmaRef.current = ogma;
    return () => { ogma.destroy(); };
  }, []);

  // Reload full graph when data changes; apply visibility immediately after layout
  useEffect(() => {
    if (!ogmaRef.current) return;
    const ogma = ogmaRef.current;

    const timeNodeIds = new Set(data.nodes.filter(n => n.type === 'TIME').map(n => n.id));

    const nodes = data.nodes
      .filter(n => n.type !== 'TIME')
      .map((node: GraphNode) => ({
        id: node.id,
        data: { type: node.type, label: node.label, ...node.properties },
      }));

    const edges = data.edges
      .filter(e => !timeNodeIds.has(e.source) && !timeNodeIds.has(e.target))
      .map((edge: GraphEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: { type: edge.type, ...edge.properties },
      }));

    ogma.clearGraph();
    ogma.addGraph({ nodes, edges }).then(() => {
      applyNodeImages(ogma);
      applyVisibility(ogma, visibleNodeIds, visibleEdgeIds);

      // Seed positions in concentric rings by node type so force has a head start
      const RING: Record<string, number> = { PERSON: 0, WITNESS: 350, LOCATION: 700, ACTIVITY: 1050, ASSOCIATE: 1050 };
      const counts: Record<string, number> = {};
      ogma.getNodes().forEach((n: any) => {
        const type: string = n.getData('type') || 'WITNESS';
        const r = RING[type] ?? 700;
        if (r === 0) { n.setPosition({ x: 0, y: 0 }); return; }
        counts[type] = (counts[type] || 0) + 1;
      });
      const indices: Record<string, number> = {};
      const totals: Record<string, number> = { ...counts };
      ogma.getNodes().forEach((n: any) => {
        const type: string = n.getData('type') || 'WITNESS';
        const r = RING[type] ?? 700;
        if (r === 0) return;
        const idx = indices[type] = (indices[type] || 0) + 1;
        const total = totals[type] || 1;
        const angle = (idx / total) * 2 * Math.PI;
        n.setPosition({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
      });

      return ogma.layouts.force({
        charge: -4000, linkDistance: 250, gravity: 0.05, iterations: 500, locate: false,
      });
    }).then(() => {
      if (nodes.length > 0) setTimeout(() => ogma.view.locateGraph({ padding: 150, duration: 1000 }), 300);
    });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visibility toggle — no layout re-run
  useEffect(() => {
    if (!ogmaRef.current) return;
    applyVisibility(ogmaRef.current, visibleNodeIds, visibleEdgeIds);
  }, [visibleNodeIds, visibleEdgeIds]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#f0f2f5' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div ref={tooltipRef} style={{
        display: 'none', position: 'absolute', pointerEvents: 'none',
        backgroundColor: 'rgba(15,23,42,0.9)', color: '#f8fafc',
        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        maxWidth: 260, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', zIndex: 50,
        whiteSpace: 'pre-wrap', lineHeight: 1.4,
      }} />
    </div>
  );
}
