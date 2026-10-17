import { useEffect, useState, useCallback } from 'react';

// Mirrors apps/api/src/verification/verification.service.ts's VerificationRecord.
type VerificationStatus = 'awaiting_decision' | 'approved' | 'denied' | 'unreachable_fallback';

interface VerificationRecord {
  event: {
    eventId: string;
    siteId: string;
    eventType: string;
    visitorPhoneNumber?: string;
    notes?: string;
  };
  status: VerificationStatus;
  statedName?: string;
  statedPurpose?: string;
  summary?: string;
  suspicious?: boolean;
  flagReason?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
// Matches DASHBOARD_API_KEY in apps/api/.env — set your own in apps/web/.env
// before this is used anywhere beyond local testing.
const API_KEY = import.meta.env.VITE_API_KEY || 'changeme_dev_only';
const apiHeaders = { 'X-API-Key': API_KEY };

export default function App() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/verification`, { headers: apiHeaders });
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error('Failed to load verification events', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000); // simple polling for the demo
    return () => clearInterval(interval);
  }, [load]);

  const decide = async (eventId: string, approve: boolean) => {
    await fetch(`${API_BASE}/verification/${eventId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiHeaders },
      body: JSON.stringify({ approve, decidedBy: 'diaspora-dashboard' }),
    });
    load();
  };

  return (
    <div className="app">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo-badge.svg" alt="" width={56} height={56} />
        GateGuard
      </h1>
      <p className="subtitle">
        Live visitor verification for your compound — approve or deny access
        from anywhere.
      </p>

      {loading && <p>Loading…</p>}
      {!loading && records.length === 0 && (
        <p className="empty">No visitor events yet. Trigger one from Ring or the API test script.</p>
      )}

      {records
        .slice()
        .reverse()
        .map((r) => (
          <div className="card" key={r.event.eventId}>
            <div className="card-top">
              <span className="site">{r.event.siteId}</span>
              <span className={`status status-${r.status} status-default`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>

            {(r.statedName || r.statedPurpose) && (
              <p className="transcript">
                {r.statedName && <>Says they're <strong>{r.statedName}</strong>. </>}
                {r.statedPurpose && <>Purpose: "{r.statedPurpose}"</>}
              </p>
            )}
            {!r.statedName && !r.statedPurpose && r.summary && (
              <p className="transcript">"{r.summary}"</p>
            )}

            {r.flagReason && (
              <p className={`flag ${r.suspicious ? 'suspicious' : 'clear'}`}>
                {r.suspicious ? '⚠ ' : '✓ '}
                {r.flagReason}
              </p>
            )}

            {r.status === 'unreachable_fallback' && (
              <p className="flag suspicious">
                ⚠ Could not reach visitor by call — gateman handling on-site
                fallback.
              </p>
            )}

            {r.status === 'awaiting_decision' && (
              <div className="actions">
                <button className="approve" onClick={() => decide(r.event.eventId, true)}>
                  Approve
                </button>
                <button className="deny" onClick={() => decide(r.event.eventId, false)}>
                  Deny
                </button>
              </div>
            )}
          </div>
        ))}

      <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginTop: 32 }}>
        Persist. Build. Conquer. · by Gbeti Biendev Engr
      </p>
    </div>
  );
}