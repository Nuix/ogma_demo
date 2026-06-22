import { useState, useRef, useEffect, useCallback } from 'react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export interface SelectedLocation {
  label: string;
  lat: number;
  lng: number;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (loc: SelectedLocation | null, rawText: string) => void;
  disabled?: boolean;
  required?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  color: '#1e293b',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

export function LocationAutocomplete({ value, onChange, disabled, required }: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setSelected(false);
    onChange(null, q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  };

  const handleSelect = (r: NominatimResult) => {
    // Shorten display_name to first 2 parts (e.g. "Café X, Fitzroy" not full address)
    const short = r.display_name.split(',').slice(0, 2).join(',').trim();
    setQuery(short);
    setSelected(true);
    setOpen(false);
    onChange({ label: short, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }, short);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => results.length > 0 && !selected && setOpen(true)}
        placeholder="Start typing an address or place…"
        disabled={disabled}
        required={required}
        style={{ ...inputStyle, borderColor: selected ? '#06b6d4' : '#e2e8f0' }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: 9, fontSize: 11, color: '#94a3b8' }}>searching…</div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 999, top: '100%', left: 0, right: 0,
          backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2, maxHeight: 240, overflowY: 'auto',
        }}>
          {results.map(r => (
            <button key={r.place_id} type="button" onMouseDown={() => handleSelect(r)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 12, color: '#1e293b', lineHeight: 1.4,
              borderBottom: '1px solid #f1f5f9',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontWeight: 600 }}>{r.display_name.split(',')[0]}</span>
              <span style={{ color: '#94a3b8', marginLeft: 4 }}>
                {r.display_name.split(',').slice(1, 3).join(',')}
              </span>
            </button>
          ))}
          <div style={{ padding: '4px 12px', fontSize: 10, color: '#cbd5e1', borderTop: '1px solid #f1f5f9' }}>
            © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  );
}
