import { useState } from 'react';
import { submitWitnessStatement } from '../services/api';
import { WitnessStatementResponse } from '../types';
import { LocationAutocomplete, SelectedLocation } from './LocationAutocomplete';

interface WitnessFormProps {
  onSubmitSuccess: () => void;
}

const ACTIVITY_ICONS = ['☕', '🍕', '🏃', '📚', '💻', '🛍️', '🎮', '🍺', '🎭', '🚶', '🏊', '🎯', '🍔', '🧘', '🎸'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  color: '#1e293b',
  fontSize: 13,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 5,
  color: '#64748b',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

export function WitnessForm({ onSubmitSuccess }: WitnessFormProps) {
  const [witnessName, setWitnessName] = useState('');
  const [location, setLocation] = useState('');
  const [locationCoords, setLocationCoords] = useState<SelectedLocation | null>(null);
  const [activity, setActivity] = useState('');
  const [activityIcon, setActivityIcon] = useState(ACTIVITY_ICONS[0]);
  const [associate, setAssociate] = useState('');
  const [time, setTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<WitnessStatementResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;
    setIsSubmitting(true);
    setResponse(null);
    try {
      const result = await submitWitnessStatement({
        witnessName: witnessName.trim() || undefined,
        location: locationCoords?.label ?? location.trim(),
        locationLat: locationCoords?.lat,
        locationLng: locationCoords?.lng,
        activity: activity.trim() || undefined,
        activityIcon: activity.trim() ? activityIcon : undefined,
        associate: associate.trim() || undefined,
        time: time || undefined,
      });
      setResponse(result);
      if (result.success) {
        setLocation(''); setLocationCoords(null); setActivity(''); setAssociate(''); setTime('');
        setTimeout(() => { setResponse(null); onSubmitSuccess(); }, 3500);
      }
    } catch {
      setResponse({ success: false, status: 'rejected', message: 'Failed to submit. Please try again.', reason: 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>Submit Witness Statement</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Report a sighting of Cameron Stiller</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Your Name (Optional)</label>
          <input type="text" value={witnessName} onChange={e => setWitnessName(e.target.value)}
            placeholder="Anonymous" disabled={isSubmitting} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>📍 Where was Cameron seen? <span style={{ color: '#e74c3c' }}>*</span></label>
          <LocationAutocomplete
            value={location}
            onChange={(loc, raw) => { setLocationCoords(loc); setLocation(raw); }}
            disabled={isSubmitting}
            required
          />
          {locationCoords && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#06b6d4' }}>
              ✓ Location pinned to map
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>🎯 What were they doing?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {ACTIVITY_ICONS.map(icon => (
              <button key={icon} type="button" onClick={() => setActivityIcon(icon)} style={{
                width: 34, height: 34, fontSize: 18,
                border: `2px solid ${icon === activityIcon ? '#e74c3c' : '#e2e8f0'}`,
                borderRadius: 6,
                backgroundColor: icon === activityIcon ? '#fef2f2' : '#f8fafc',
                cursor: 'pointer', padding: 0, lineHeight: 1,
              }}>{icon}</button>
            ))}
          </div>
          <input type="text" value={activity} onChange={e => setActivity(e.target.value)}
            placeholder="e.g. drinking coffee, reading a book…"
            disabled={isSubmitting} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>
            🤝 Who / what were they with?
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
              (optional — leave blank if alone)
            </span>
          </label>
          <input type="text" value={associate} onChange={e => setAssociate(e.target.value)}
            placeholder="e.g. their colleague, a dog…"
            disabled={isSubmitting} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>🕐 When was this?</label>
          <input type="datetime-local" value={time} onChange={e => setTime(e.target.value)}
            disabled={isSubmitting} style={{ ...inputStyle, colorScheme: 'light' }} />
        </div>

        <button type="submit" disabled={isSubmitting || !location.trim()} style={{
          width: '100%', padding: '10px',
          backgroundColor: isSubmitting || !location.trim() ? '#cbd5e1' : '#e74c3c',
          color: '#fff', border: 'none', borderRadius: 6,
          fontSize: 13, fontWeight: 700,
          cursor: isSubmitting || !location.trim() ? 'not-allowed' : 'pointer',
          letterSpacing: '0.05em',
        }}>
          {isSubmitting ? 'Filing report…' : 'Submit Sighting'}
        </button>
      </form>

      {response && (
        <div style={{
          marginTop: 16, padding: 14,
          backgroundColor: response.success ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${response.success ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 8,
        }}>
          <p style={{ margin: 0, color: response.success ? '#15803d' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
            {response.message}
          </p>
          {response.badge && (
            <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
              <div>Investigator: {response.badge.name}</div>
              <div>Case #: {response.badge.caseNumber}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
