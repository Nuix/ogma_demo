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

interface ActivitySat { node: GraphNode; associates: GraphNode[]; }

function wrapLabel(label: string, maxLen = 13): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let cur = '';
  words.forEach(w => {
    if ((cur + ' ' + w).trim().length > maxLen && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function buildClusterIcon(
  locationNode: GraphNode,
  activities: ActivitySat[],
  isCurrent: boolean,
  opacity: number,
): L.DivIcon {
  const centerR = 36;
  const actR    = 24;
  const assocR  = 18;
  const orbit1  = activities.length > 0 ? 110 : 0;
  const orbit2  = 72;
  const pad     = centerR + orbit1 + actR + orbit2 + assocR + 44;
  const size    = pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const aStep = activities.length > 0 ? (2 * Math.PI) / activities.length : 0;

  let linesSvg = '';
  let nodesSvg = '';

  activities.forEach((act, i) => {
    const actAngle = i * aStep - Math.PI / 2;
    const ax = cx + orbit1 * Math.cos(actAngle);
    const ay = cy + orbit1 * Math.sin(actAngle);

    linesSvg += `<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" stroke="#475569" stroke-width="2" opacity="0.5"/>`;

    const actEmoji = act.node.properties?.icon || '⚡';
    const actLabelLines = wrapLabel(act.node.label);
    const actLabelY = ay + actR + 14;
    const actLabelSvg = actLabelLines.map((l, li) =>
      `<text x="${ax}" y="${actLabelY + li * 13}" text-anchor="middle" font-size="10"
        fill="#1e293b" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif"
        stroke="white" stroke-width="3" paint-order="stroke fill">${l}</text>`
    ).join('');

    nodesSvg += `
      <circle cx="${ax}" cy="${ay}" r="${actR}" fill="${NODE_COLORS.ACTIVITY}" stroke="white" stroke-width="2.5"/>
      <text x="${ax}" y="${ay + 8}" text-anchor="middle" font-size="16"
        font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${actEmoji}</text>
      ${actLabelSvg}
    `;

    const n = act.associates.length;
    if (n > 0) {
      const spreadStep = n > 1 ? (Math.PI * 0.7) / (n - 1) : 0;
      const baseAngle  = actAngle; // fan outward from activity (away from center)
      act.associates.forEach((assoc, j) => {
        const offset = n > 1 ? (j - (n - 1) / 2) * spreadStep : 0;
        const bAngle = baseAngle + offset;
        const bx = ax + orbit2 * Math.cos(bAngle);
        const by = ay + orbit2 * Math.sin(bAngle);
        const assocLabelLines = wrapLabel(assoc.label);
        const assocLabelY = by + assocR + 13;
        const assocLabelSvg = assocLabelLines.map((l, li) =>
          `<text x="${bx}" y="${assocLabelY + li * 12}" text-anchor="middle" font-size="10"
            fill="#1e293b" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif"
            stroke="white" stroke-width="3" paint-order="stroke fill">${l}</text>`
        ).join('');
        linesSvg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#f59e0b" stroke-width="1.5" opacity="0.6"/>`;
        nodesSvg += `
          <circle cx="${bx}" cy="${by}" r="${assocR}" fill="${NODE_COLORS.ASSOCIATE}" stroke="white" stroke-width="2"/>
          <text x="${bx}" y="${by + 6}" text-anchor="middle" font-size="13"
            font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">👤</text>
          ${assocLabelSvg}
        `;
      });
    }
  });

  const locShort    = locationNode.label.split(',')[0].trim();
  const centerEmoji = isCurrent ? '🎯' : '📍';
  const centerFill  = isCurrent ? '#e74c3c' : '#06b6d4';
  const locColor    = isCurrent ? '#e74c3c' : '#475569';

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"
      style="overflow:visible;opacity:${opacity};transition:opacity 1s ease">
    ${linesSvg}
    <circle cx="${cx}" cy="${cy}" r="${centerR}" fill="${centerFill}" stroke="white" stroke-width="3"/>
    <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="26"
      font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${centerEmoji}</text>
    ${nodesSvg}
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
    // Let Leaflet measure the container after it's painted
    setTimeout(() => mapRef.current?.invalidateSize(), 0);
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

    // ── Satellites: Location → Activity → Associate ──────────────────────────
    // _acts: Map<actNodeId, ActivitySat> per group
    const activityToGroup = new Map<string, any>(); // actNodeId → group

    data.edges.forEach(e => {
      if (!isEdgeVisible(e.id) || e.type !== 'HAS_ACTIVITY') return;
      const loc = nodeById.get(e.source);
      if (!loc) return;
      const key = loc.properties?.suburb || loc.label;
      const grp = suburbMap.get(key);
      if (!grp) return;
      const actNode = nodeById.get(e.target);
      if (!actNode || actNode.type !== 'ACTIVITY' || !isNodeVisible(actNode.id)) return;
      if (!(grp as any)._acts) (grp as any)._acts = new Map<string, ActivitySat>();
      (grp as any)._acts.set(actNode.id, { node: actNode, associates: [] });
      activityToGroup.set(actNode.id, grp);
    });

    data.edges.forEach(e => {
      if (!isEdgeVisible(e.id) || e.type !== 'WITH') return;
      const grp = activityToGroup.get(e.source);
      if (!grp || !(grp as any)._acts) return;
      const assocNode = nodeById.get(e.target);
      if (!assocNode || assocNode.type !== 'ASSOCIATE' || !isNodeVisible(assocNode.id)) return;
      (grp as any)._acts.get(e.source)?.associates.push(assocNode);
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

      const activities: ActivitySat[] = (grp as any)._acts ? Array.from((grp as any)._acts.values()) : [];

      if (isCurrent) {
        const labelNode = { id: '', type: 'LOCATION' as const, label: grp.label, properties: grp };
        const icon = buildClusterIcon(labelNode, activities, true, 1);
        const tooltipLines = activities.flatMap(a => [
          (a.node.properties?.icon || '⚡') + ' ' + a.node.label,
          ...a.associates.map(assoc => '&nbsp;&nbsp;👤 ' + assoc.label),
        ]);
        const tooltipHtml = `<strong>${grp.label}</strong>${tooltipLines.length ? '<br>' + tooltipLines.join('<br>') : ''}`;
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
    if (currentLatLng && containerRef.current?.offsetParent !== null) {
      try {
        mapRef.current!.setView(currentLatLng, 12, { animate: true, duration: 1.2 });
      } catch {
        mapRef.current!.setView(currentLatLng, 12, { animate: false });
      }
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
