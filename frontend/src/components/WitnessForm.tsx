import { useState } from 'react';
import { submitWitnessStatement } from '../services/api';
import { WitnessStatementResponse } from '../types';
import { LocationAutocomplete, SelectedLocation } from './LocationAutocomplete';

interface WitnessFormProps {
  onSubmitSuccess: () => void;
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
  const [location, setLocation] = useState('');
  const [locationCoords, setLocationCoords] = useState<SelectedLocation | null>(null);
  const [activity, setActivity] = useState('');
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
        location: locationCoords?.label ?? location.trim(),
        activity: activity.trim() || undefined,
        associate: associate.trim() || undefined,
        time: time || undefined,
      });
      setResponse(result);
      if (result.success) {
        setLocation(''); setLocationCoords(null); setActivity(''); setAssociate(''); setTime('');
        setTimeout(() => { setResponse(null); onSubmitSuccess(); }, 3000);
      }
    } catch {
      setResponse({ success: false, status: 'rejected', message: 'Failed to submit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>Submit Sighting</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Add a confirmed sighting to the investigation board</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>📍 Location <span style={{ color: '#e74c3c' }}>*</span></label>
          <LocationAutocomplete
            value={location}
            onChange={(loc, raw) => { setLocationCoords(loc); setLocation(raw); }}
            disabled={isSubmitting}
            required
          />
          {locationCoords && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#06b6d4' }}>✓ Location found</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>🎯 Activity</label>
          <input type="text" value={activity} onChange={e => setActivity(e.target.value)}
            placeholder="e.g. drinking coffee, reading a book…"
            disabled={isSubmitting} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>🤝 Associate</label>
          <input type="text" value={associate} onChange={e => setAssociate(e.target.value)}
            placeholder="e.g. a colleague, a suspicious dog…"
            disabled={isSubmitting} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>🕐 When</label>
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
          {isSubmitting ? 'Filing…' : 'Submit Sighting'}
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
        </div>
      )}
    </div>
  );
}
