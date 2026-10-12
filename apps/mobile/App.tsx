import { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Same shape as apps/web/src/App.tsx — mirrors
// apps/api/src/verification/verification.service.ts's VerificationRecord.
interface VerificationRecord {
  event: { eventId: string; siteId: string; eventType: string; notes?: string };
  status: string;
  statedName?: string;
  statedPurpose?: string;
  summary?: string;
  suspicious?: boolean;
  flagReason?: string;
}

// Point this at your deployed/tunnelled API URL for the demo.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
// Matches DASHBOARD_API_KEY in apps/api/.env
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'changeme_dev_only';
const apiHeaders = { 'X-API-Key': API_KEY };

export default function App() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/verification`, { headers: apiHeaders });
      const data = await res.json();

      if (!res.ok) {
        console.warn(`API returned ${res.status}:`, data);
        setRecords([]);
        return;
      }

      if (!Array.isArray(data)) {
        console.warn('API did not return an array:', data);
        setRecords([]);
        return;
      }

      setRecords(data);
    } catch (err) {
      console.warn('Could not reach GateGuard API — offline mode', err);
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const decide = async (eventId: string, approve: boolean) => {
    try {
      await fetch(`${API_BASE}/verification/${eventId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({ approve, decidedBy: 'gateman-onsite' }),
      });
      load();
    } catch {
      // Offline-first: gateman uses their own judgement on-site when the
      // network is unreachable; the decision syncs once connectivity returns.
    }
  };

  const pending = records.filter((r) => r.status === 'awaiting_decision');
  const fallback = records.filter((r) => r.status === 'unreachable_fallback');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>GateGuard — Gate Companion</Text>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {fallback.length > 0 && (
          <View style={styles.fallbackBanner}>
            <Text style={styles.fallbackText}>
              {fallback.length} visitor(s) could not be reached by call. Use
              your judgement and log a manual decision below.
            </Text>
          </View>
        )}

        {[...pending, ...fallback].length === 0 && (
          <Text style={styles.empty}>No pending visitors right now.</Text>
        )}

        {[...pending, ...fallback].map((r) => (
          <View style={styles.card} key={r.event.eventId}>
            <Text style={styles.site}>{r.event.siteId}</Text>
            {(r.statedName || r.statedPurpose) && (
              <Text style={styles.transcript}>
                {r.statedName ? `${r.statedName} — ` : ''}
                {r.statedPurpose || r.summary || ''}
              </Text>
            )}
            {r.flagReason && (
              <Text style={r.suspicious ? styles.flagBad : styles.flagGood}>
                {r.suspicious ? '⚠ ' : '✓ '}
                {r.flagReason}
              </Text>
            )}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.approve]}
                onPress={() => decide(r.event.eventId, true)}
              >
                <Text style={styles.buttonText}>Let in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.deny]}
                onPress={() => decide(r.event.eventId, false)}
              >
                <Text style={styles.buttonText}>Turn away</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115', paddingHorizontal: 16, paddingTop: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  empty: { color: '#777', textAlign: 'center', marginTop: 40 },
  fallbackBanner: {
    backgroundColor: '#3a1a4a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  fallbackText: { color: '#cf9df0', fontSize: 13 },
  card: {
    backgroundColor: '#1a1d24',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderColor: '#2a2e37',
    borderWidth: 1,
  },
  site: { color: '#fff', fontWeight: '600', marginBottom: 6 },
  transcript: { color: '#d0d0d0', fontStyle: 'italic', marginBottom: 6 },
  flagBad: { color: '#f08787', marginBottom: 10, fontSize: 13 },
  flagGood: { color: '#7ee29a', marginBottom: 10, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  approve: { backgroundColor: '#2e7d4f' },
  deny: { backgroundColor: '#a33a3a' },
  buttonText: { color: '#fff', fontSize: 14 },
});
