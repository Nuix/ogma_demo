import { useState, useEffect, useMemo, useRef, Component, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { GraphVisualization } from './components/GraphVisualization';
import { MapView } from './components/MapView';
import { WitnessForm } from './components/WitnessForm';
import { fetchGraph } from './services/api';
import { GraphData } from './types';

class GraphErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e74c3c', padding: 40 }}>
          <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, padding: 24, maxWidth: 500 }}>
            <strong>Graph failed to load:</strong>
            <pre style={{ fontSize: 12, marginTop: 8, color: '#666' }}>{this.state.error}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LEGEND_ITEMS = [
  { color: '#e74c3c', shape: '🎯', label: 'Cameron (POI)' },
  { color: '#3b82f6', shape: '👁️', label: 'Witness' },
  { color: '#06b6d4', shape: '📍', label: 'Location' },
  { color: '#8b5cf6', shape: '⚡', label: 'Activity' },
  { color: '#f59e0b', shape: '👤', label: 'Associate' },
];

type ViewMode = 'graph' | 'map';

const isStaffRoute = window.location.pathname.endsWith('/staff');

function App() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showForm, setShowForm] = useState(isStaffRoute);
  const [playbackStep, setPlaybackStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [playSpeed, setPlaySpeed] = useState(3000);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Order unique case numbers by their earliest edge timestamp
  const submissionCases = useMemo(() => {
    const caseTs = new Map<string, string>();
    graphData.edges.forEach(e => {
      const cn = e.properties?.caseNumber;
      const ts = e.properties?.timestamp;
      if (cn && ts && (!caseTs.has(cn) || ts < caseTs.get(cn)!)) caseTs.set(cn, ts);
    });
    return Array.from(caseTs.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([cn]) => cn);
  }, [graphData.edges]);

  const { visibleNodeIds, visibleEdgeIds } = useMemo(() => {
    if (playbackStep === -1 || submissionCases.length === 0) return { visibleNodeIds: null, visibleEdgeIds: null };
    const visibleCases = new Set(submissionCases.slice(0, playbackStep + 1));
    const edgeIds = new Set<string>();
    const nodeIds = new Set<string>();
    graphData.edges.forEach(e => {
      const cn = e.properties?.caseNumber;
      if (!cn || visibleCases.has(cn)) {
        edgeIds.add(e.id);
        nodeIds.add(e.source);
        nodeIds.add(e.target);
      }
    });
    graphData.nodes.filter(n => n.properties?.status === 'MISSING').forEach(n => nodeIds.add(n.id));
    return { visibleNodeIds: nodeIds, visibleEdgeIds: edgeIds };
  }, [graphData, playbackStep, submissionCases]);

  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setPlaybackStep(prev => {
          const next = prev + 1;
          if (next >= submissionCases.length) { setIsPlaying(false); return submissionCases.length - 1; }
          return next;
        });
      }, playSpeed);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
  }, [isPlaying, submissionCases.length, playSpeed]);

  const hasAutoPlayed = useRef(false);

  const loadGraph = async () => {
    try { setGraphData(await fetchGraph()); }
    catch (e) { console.error('Failed to load graph:', e); }
  };

  // Auto-play from first node on initial load
  useEffect(() => {
    if (hasAutoPlayed.current || submissionCases.length === 0) return;
    hasAutoPlayed.current = true;
    setPlaybackStep(0);
    setIsPlaying(true);
  }, [submissionCases]);

  useEffect(() => { loadGraph(); }, []);

  useEffect(() => {
    const basePath = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
    const s = io({ path: `${basePath}/socket.io` });
    s.on('connect', () => s.emit('subscribe', { room: 'investigation' }));
    s.on('graph:updated', () => loadGraph());
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const witnesses = graphData.nodes.filter(n => n.type === 'ASSOCIATE').length;
  const locations = graphData.nodes.filter(n => n.type === 'LOCATION').length;
  const activities = graphData.nodes.filter(n => n.type === 'ACTIVITY').length;

  const lastSeen = useMemo(() => {
    const ts = graphData.edges
      .filter(e => e.properties?.timestamp)
      .map(e => e.properties!.timestamp as string)
      .sort()
      .at(-1);
    if (!ts) return null;
    return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' });
  }, [graphData.edges]);

  return (
    <div style={{
      width: '100vw', height: '100vh', backgroundColor: '#f0f2f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex', flexDirection: 'column', color: '#1a1a2e',
    }}>
      {/* Header */}
      <header style={{
        padding: '0 24px', height: '60px', backgroundColor: '#fff',
        borderBottom: '1px solid #e2e8f0', display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', backgroundColor: '#e74c3c',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🔍</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.03em', color: '#1a1a2e' }}>
              OPERATION: FIND CAMERON STILLER
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.05em' }}>
              STATUS: <span style={{ color: '#e74c3c', fontWeight: 600 }}>MISSING</span>
              {lastSeen && <>&nbsp;·&nbsp;LAST SEEN: {lastSeen}</>}
            </div>
          </div>
        </div>

        {/* Centre: attributions */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
          <a href="https://doc.linkurious.com/ogma/latest/" target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: '#94a3b8' }}>
            Graph powered by <strong style={{ color: '#475569' }}>Ogma</strong> · Linkurious
          </a>
          <br />
          <a href="https://github.com/Nuix/ogma_demo" target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: '#94a3b8' }}>
            ⭐ <strong style={{ color: '#475569' }}>Open source</strong> · github.com/Nuix/ogma_demo
          </a>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
          {[
            { label: 'Associates', value: witnesses, color: '#3b82f6' },
            { label: 'Locations', value: locations, color: '#06b6d4' },
            { label: 'Activities', value: activities, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              backgroundColor: s.color + '15', border: `1px solid ${s.color}40`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.value}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{s.label}</span>
            </div>
          ))}

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginLeft: 4 }}>
            {(['graph', 'map'] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                backgroundColor: viewMode === mode ? '#1e293b' : '#fff',
                color: viewMode === mode ? '#fff' : '#64748b',
                letterSpacing: '0.04em',
              }}>
                {mode === 'graph' ? '⬡ GRAPH' : '🗺 MAP'}
              </button>
            ))}
          </div>

          {isStaffRoute && (
            <button onClick={() => setShowForm(!showForm)} style={{
              padding: '8px 20px', backgroundColor: showForm ? '#64748b' : '#e74c3c',
              color: '#fff', border: 'none', borderRadius: 6, fontSize: 13,
              fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
            }}>
              {showForm ? '✕ CLOSE' : '+ SUBMIT SIGHTING'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {viewMode === 'graph' ? (
            <GraphErrorBoundary>
              <GraphVisualization data={graphData} visibleNodeIds={visibleNodeIds} visibleEdgeIds={visibleEdgeIds} />
            </GraphErrorBoundary>
          ) : (
            <MapView data={graphData} visibleNodeIds={visibleNodeIds} visibleEdgeIds={visibleEdgeIds} />
          )}

          {/* Legend (graph only) */}
          {viewMode === 'graph' && (
            <div style={{
              position: 'absolute', bottom: 20, left: 20, backgroundColor: '#fff',
              borderRadius: 10, padding: '12px 16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)', minWidth: 160,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 10 }}>
                LEGEND
              </div>
              {LEGEND_ITEMS.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{item.shape}</span>
                  <span style={{ color: '#475569' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Witness Form Overlay */}
        {showForm && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 420, height: '100%', backgroundColor: '#fff',
            borderLeft: '1px solid #e2e8f0', overflowY: 'auto',
            zIndex: 1000, boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
            padding: 20, boxSizing: 'border-box',
          }}>
            <WitnessForm onSubmitSuccess={() => { loadGraph(); setShowForm(false); }} />
          </div>
        )}
      </div>

      {/* Playback Controls */}
      {submissionCases.length > 0 && (
        <div style={{
          padding: '10px 24px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          boxShadow: '0 -1px 4px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#94a3b8', marginRight: 4 }}>
            TIMELINE
          </span>
          <button onClick={() => { setPlaybackStep(0); setIsPlaying(false); }} style={pbBtn}>⏮</button>
          <button
            onClick={() => { if (playbackStep === -1) setPlaybackStep(0); setIsPlaying(p => !p); }}
            style={{ ...pbBtn, backgroundColor: '#e74c3c', color: '#fff', border: 'none' }}
          >{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={() => setPlaybackStep(s => Math.min(s + 1, submissionCases.length - 1))} style={pbBtn}>⏭</button>
          <input
            type="range" min={0} max={submissionCases.length - 1}
            value={playbackStep === -1 ? submissionCases.length - 1 : playbackStep}
            onChange={e => { setIsPlaying(false); setPlaybackStep(Number(e.target.value)); }}
            style={{ flex: 1, accentColor: '#e74c3c' }}
          />
          <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap', minWidth: 120 }}>
            {playbackStep === -1
              ? `${submissionCases.length} case${submissionCases.length !== 1 ? 's' : ''}`
              : `Case ${playbackStep + 1} / ${submissionCases.length}`}
          </span>
          <button onClick={() => { setIsPlaying(false); setPlaybackStep(-1); }} style={{ ...pbBtn, fontSize: 11, padding: '4px 10px' }}>
            SHOW ALL
          </button>

          <select
            value={playSpeed}
            onChange={e => setPlaySpeed(Number(e.target.value))}
            style={{ ...pbBtn, fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
          >
            <option value={500}>0.5s</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
          </select>
        </div>
      )}
    </div>
  );
}

const pbBtn: React.CSSProperties = {
  padding: '5px 10px', backgroundColor: '#f1f5f9', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13,
};

export default App;
