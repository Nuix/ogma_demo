import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GraphData, GraphNode } from '../types';

const NODE_COLORS: Record<string, string> = {
  WITNESS:   '#3b82f6',
  ACTIVITY:  '#8b5cf6',
  ASSOCIATE: '#f59e0b',
  LOCATION:  '#06b6d4',
  PERSON:    '#e74c3c',
};

const NODE_EMOJIS: Record<string, string> = {
  WITNESS:   '👁️',
  ACTIVITY:  '⚡',
  ASSOCIATE: '👤',
};

function buildClusterIcon(
  locationNode: GraphNode,
  satellites: GraphNode[],
  isCurrent: boolean,
  opacity: number,
): L.DivIcon {
  const centerR = 36;
  const satR    = 28;
  const orbitR  = satellites.length > 0 ? 110 : 0;
  const pad     = centerR + orbitR + satR + 40; // extra room for labels
  const size    = pad * 2;
  const cx      = size / 2;
  const cy      = size / 2;
  const angleStep = satellites.length > 0 ? (2 * Math.PI) / satellites.length : 0;

  const lines = satellites.map((_, i) => {
    const a  = i * angleStep - Math.PI / 2;
    const nx = cx + orbitR * Math.cos(a);
    const ny = cy + orbitR * Math.sin(a);
    return `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#475569" stroke-width="2" opacity="0.5"/>`;
  }).join('');

  const satNodes = satellites.map((node, i) => {
    const a     = i * angleStep - Math.PI / 2;
    const nx    = cx + orbitR * Math.cos(a);
    const ny    = cy + orbitR * Math.sin(a);
    const color = NODE_COLORS.ACTIVITY;
    const emoji = node.properties?.icon || '⚡';
    const words = node.label.split(' ');
    // Wrap label into max 2 lines of ~12 chars
    const lines2: string[] = [];
    let cur = '';
    words.forEach(w => {
      if ((cur + ' ' + w).trim().length > 13 && cur) { lines2.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines2.push(cur);
    const labelLines = lines2.slice(0, 2);
    const labelY = ny + satR + 16;
    const labelSvg = labelLines.map((l, li) =>
      `<text x="${nx}" y="${labelY + li * 14}" text-anchor="middle" font-size="11"
        fill="#1e293b" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif"
        stroke="white" stroke-width="3" paint-order="stroke fill">${l}</text>`
    ).join('');
    return `
      <circle cx="${nx}" cy="${ny}" r="${satR}" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="${nx}" y="${ny + 9}" text-anchor="middle" font-size="20"
        font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text>
      ${labelSvg}
    `;
  }).join('');

  const locShort  = locationNode.label.split(',')[0].trim();
  const centerEmoji = isCurrent ? '🎯' : '📍';
  const centerFill  = isCurrent ? '#e74c3c' : '#06b6d4';
  const locColor    = isCurrent ? '#e74c3c' : '#475569';
  const locWeight   = isCurrent ? '700' : '500';

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"
      style="overflow:visible;opacity:${opacity};transition:opacity 1s ease">
    ${lines}
    <circle cx="${cx}" cy="${cy}" r="${centerR}" fill="${centerFill}" stroke="white" stroke-width="3"/>
    <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="26"
      font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${centerEmoji}</text>
    ${satNodes}
    <text x="${cx}" y="${cy + centerR + 18}" text-anchor="middle" font-size="13"
      fill="${locColor}" font-weight="700"
      stroke="white" stroke-width="4" paint-order="stroke fill"
      font-family="-apple-system,BlinkMacSystemFont,sans-serif">${locShort}</text>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor:[0, -(size / 2 + 4)],
  });
}

interface MapViewProps {
  data: GraphData;
  visibleNodeIds?: Set<string> | null;
  visibleEdgeIds?: Set<string> | null;
}

export function MapView({ data, visibleNodeIds, visibleEdgeIds }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markerLayer  = useRef<L.LayerGroup | null>(null);
  const trailLayer   = useRef<L.LayerGroup | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { center: [-27, 134], zoom: 5, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);
    markerLayer.current = L.layerGroup().addTo(mapRef.current);
    trailLayer.current  = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Redraw whenever data or visibility changes
  useEffect(() => {
    if (!mapRef.current || !markerLayer.current || !trailLayer.current) return;
    markerLayer.current.clearLayers();
    trailLayer.current.clearLayers();

    const nodeById = new Map<string, GraphNode>(data.nodes.map(n => [n.id, n]));
    const isEdgeVisible = (id: string) => !visibleEdgeIds || visibleEdgeIds.has(id);
    const isNodeVisible = (id: string) => !visibleNodeIds || visibleNodeIds.has(id);

    const allLocations = data.nodes.filter(n =>
      n.type === 'LOCATION' && n.properties?.lat != null && n.properties?.lng != null,
    );
    if (allLocations.length === 0) return;

    // ── Build suburb groups ──────────────────────────────────────────────────
    // Key: suburb name (fallback to location label). Value: representative centroid + member location ids.
    interface SuburbGroup {
      key: string;
      label: string;
      lat: number;
      lng: number;
      locationIds: Set<string>;
      earliestTs: string;
    }
    const suburbMap = new Map<string, SuburbGroup>();

    allLocations.forEach(loc => {
      const key   = loc.properties?.suburb || loc.label;
      const lat   = loc.properties?.suburbLat ?? loc.properties?.lat;
      const lng   = loc.properties?.suburbLng ?? loc.properties?.lng;
      if (!suburbMap.has(key)) {
        suburbMap.set(key, { key, label: key, lat, lng, locationIds: new Set(), earliestTs: '' });
      }
      suburbMap.get(key)!.locationIds.add(loc.id);
    });

    // ── Earliest SEEN_AT timestamp per suburb (for sort + trail) ─────────────
    const caseToLocation = new Map<string, string>();
    data.edges.forEach(e => {
      if (e.type === 'SEEN_AT' && e.properties?.caseNumber) caseToLocation.set(e.properties.caseNumber, e.target);
    });

    data.edges.forEach(e => {
      if (e.type !== 'SEEN_AT') return;
      const loc = nodeById.get(e.target);
      if (!loc) return;
      const key = loc.properties?.suburb || loc.label;
      const grp = suburbMap.get(key);
      if (!grp) return;
      const ts: string = e.properties?.timestamp || '';
      if (!grp.earliestTs || ts < grp.earliestTs) grp.earliestTs = ts;
    });

    const sortedGroups = Array.from(suburbMap.values()).sort((a, b) => a.earliestTs.localeCompare(b.earliestTs));

    // ── Current suburb = suburb of last visible SEEN_AT location ─────────────
    let currentSuburbKey: string | null = null;
    let latestTs = '';
    data.edges.forEach(e => {
      if (e.type === 'SEEN_AT' && isEdgeVisible(e.id)) {
        const ts: string = e.properties?.timestamp || '';
        if (ts > latestTs) {
          latestTs = ts;
          const loc = nodeById.get(e.target);
          if (loc) currentSuburbKey = loc.properties?.suburb || loc.label;
        }
      }
    });
    if (!currentSuburbKey && sortedGroups.length > 0) currentSuburbKey = sortedGroups[sortedGroups.length - 1].key;

    // ── Satellites per suburb (visible activities only) ───────────────────────
    data.edges.forEach(e => {
      if (!isEdgeVisible(e.id)) return;
      const caseNum = e.properties?.caseNumber;
      if (!caseNum) return;
      const locId = caseToLocation.get(caseNum);
      if (!locId) return;
      const loc = nodeById.get(locId);
      if (!loc) return;
      const key = loc.properties?.suburb || loc.label;
      const grp = suburbMap.get(key);
      if (!grp) return;
      [e.source, e.target].forEach(nodeId => {
        const node = nodeById.get(nodeId);
        if (node && node.type === 'ACTIVITY' && isNodeVisible(node.id)) {
          if (!(grp as any)._sats) (grp as any)._sats = new Map<string, GraphNode>();
          (grp as any)._sats.set(node.id, node);
        }
      });
    });

    // ── Trail ─────────────────────────────────────────────────────────────────
    if (sortedGroups.length > 1) {
      L.polyline(
        sortedGroups.map(g => [g.lat, g.lng] as L.LatLngTuple),
        { color: '#e74c3c', weight: 2, opacity: 0.5, dashArray: '8 6' },
      ).addTo(trailLayer.current!);
    }

    // ── Markers ───────────────────────────────────────────────────────────────
    let currentLatLng: L.LatLngTuple | null = null;
    const currentIdx = sortedGroups.findIndex(g => g.key === currentSuburbKey);

    sortedGroups.forEach((grp, idx) => {
      const isCurrent  = grp.key === currentSuburbKey;
      const stepsBack  = currentIdx - idx;
      const opacity    = isCurrent ? 1 : stepsBack > 0 ? (stepsBack === 1 ? 0.4 : 0.2) : 0.08;
      const lat        = grp.lat;
      const lng        = grp.lng;
      if (isCurrent) currentLatLng = [lat, lng];

      const satellites: GraphNode[] = (grp as any)._sats ? Array.from((grp as any)._sats.values()) : [];

      if (isCurrent) {
        // Build a fake location node for the cluster label
        const labelNode = { id: '', type: 'LOCATION' as const, label: grp.label, properties: grp };
        const icon = buildClusterIcon(labelNode, satellites, true, 1);
        const tooltipHtml = `<strong>${grp.label}</strong>${satellites.length ? '<br>' + satellites.map(s => (s.properties?.icon || '⚡') + ' ' + s.label).join('<br>') : ''}`;
        L.marker([lat, lng], { icon, interactive: true })
          .bindTooltip(tooltipHtml, { direction: 'top', className: 'map-tooltip', offset: [0, -10] })
          .addTo(markerLayer.current!);
      } else {
        const pinSvg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity};transition:opacity 1s ease">
          <circle cx="16" cy="16" r="14" fill="#06b6d4" stroke="white" stroke-width="2"/>
          <text x="16" y="21" text-anchor="middle" font-size="14"
            font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">📍</text>
        </svg>`;
        const icon = L.divIcon({ html: pinSvg, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
        L.marker([lat, lng], { icon, interactive: true })
          .bindTooltip(grp.label, { direction: 'top', className: 'map-tooltip', offset: [0, -6] })
          .addTo(markerLayer.current!);
      }
    });

    // ── Pan to current suburb ─────────────────────────────────────────────────
    if (currentLatLng) {
      mapRef.current!.setView(currentLatLng, 12, { animate: true, duration: 1.2 });
    }
  }, [data, visibleNodeIds, visibleEdgeIds]);

  const geocodedCount = data.nodes.filter(n => n.type === 'LOCATION' && n.properties?.lat).length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`.map-tooltip { background: rgba(15,23,42,0.9); color: #f8fafc; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; padding: 5px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); line-height: 1.6; } .map-tooltip::before { display: none; }`}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {geocodedCount === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
          color: '#94a3b8', pointerEvents: 'none',
          background: 'rgba(240,242,245,0.85)',
        }}>
          <div style={{ fontSize: 36 }}>🗺️</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No geocoded sightings yet</div>
          <div style={{ fontSize: 12 }}>Select a location from the autocomplete when submitting a sighting</div>
        </div>
      )}
    </div>
  );
}
