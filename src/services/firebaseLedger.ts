import { collection, doc, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StagedStateAction, CommittedExecutionLog, SyncActionOptions, VoidActionOptions } from '../types/aegisTypes';
import { syncActionToFirestore, voidTransactionInFirestore, getRecentLedgerEntries } from '../db/firebaseLedger';
import { firestoreBillingTracker } from './firestoreBillingTracker';

export { syncActionToFirestore, voidTransactionInFirestore, getRecentLedgerEntries };
export type { SyncActionOptions, VoidActionOptions };

export interface FirestoreDiagnosticResult {
  isConnected: boolean;
  latencyMs: number;
  lastChecked: string;
  collection: string;
  transport: string;
  activeListeners: number;
  totalSyncedDocs: number;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  error?: string;
}

/**
 * Diagnostic ping tester that benchmarks real-time Firestore round-trip latency.
 */
export async function testFirestoreDiagnostics(): Promise<FirestoreDiagnosticResult> {
  const startTime = performance.now();
  const timestamp = new Date().toLocaleTimeString();

  try {
    if (!db) {
      return {
        isConnected: false,
        latencyMs: 0,
        lastChecked: timestamp,
        collection: 'ledger_entries',
        transport: 'In-Memory State Engine',
        activeListeners: 0,
        totalSyncedDocs: 0,
        status: 'OFFLINE',
        error: 'Firestore DB instance not initialized'
      };
    }

    const testQuery = query(collection(db, 'ledger_entries'), limit(1));
    const snapshot = await getDocs(testQuery);
    const endTime = performance.now();
    const latencyMs = Math.max(1, Math.round(endTime - startTime));

    // Record read operation in billing tracker
    firestoreBillingTracker.recordOperation(
      'READ',
      'ledger_entries',
      1,
      `Diagnostic ping latency test (${latencyMs}ms)`
    );

    return {
      isConnected: true,
      latencyMs,
      lastChecked: timestamp,
      collection: 'ledger_entries',
      transport: 'Firestore WebChannel / HTTP/2',
      activeListeners: 1,
      totalSyncedDocs: snapshot.size,
      status: latencyMs > 250 ? 'DEGRADED' : 'ONLINE'
    };
  } catch (err: any) {
    const endTime = performance.now();
    const latencyMs = Math.max(1, Math.round(endTime - startTime));
    return {
      isConnected: false,
      latencyMs,
      lastChecked: timestamp,
      collection: 'ledger_entries',
      transport: 'Local Memory Fallback',
      activeListeners: 0,
      totalSyncedDocs: 0,
      status: 'OFFLINE',
      error: err?.message || 'Connection timed out'
    };
  }
}

/**
 * Real-time listener for the last N (default: 10) ledger entries from 'ledger_entries'
 * using `onSnapshot` for live updates.
 */
export function subscribeToLiveLedgerEntries(
  maxEntries = 10,
  onUpdate: (entries: CommittedExecutionLog[]) => void
) {
  const ledgerColRef = collection(db, 'ledger_entries');
  const q = query(ledgerColRef, orderBy('createdAt', 'desc'), limit(maxEntries));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: CommittedExecutionLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          action_type: data.action_type || 'UNKNOWN_ACTION',
          target_id: data.target_id || '',
          account_id: data.account_id,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
          amountUSD: data.amountUSD,
          amountINR: data.amountINR,
          percentage: data.percentage,
          feeUSD: data.feeUSD,
          feeINR: data.feeINR,
          citation: data.citation || '',
          txHash: data.txHash || `TXN-${docSnap.id.slice(0, 6)}`,
          details: data.details || '',
          documentName: data.documentName,
          tierLevel: data.tierLevel,
          operatorEmail: data.operatorEmail || (data.operatorUid ? `${data.operatorUid}@internal` : 'operator@aegisops.internal'),
          status: data.status || 'COMMITTED',
          voidedAt: data.voidedAt,
          voidReason: data.voidReason,
          voidedBy: data.voidedBy,
          batchId: data.batchId,
          createdAt: data.createdAt
        });
      });

      // Record reads in billing tracker
      if (snapshot.docs.length > 0) {
        firestoreBillingTracker.recordOperation(
          'READ',
          'ledger_entries',
          snapshot.docs.length,
          `onSnapshot sync received ${snapshot.docs.length} entries`
        );
      }

      onUpdate(logs);
    },
    (err) => {
      console.warn('Firestore live ledger onSnapshot note:', err.message);
      try {
        const fallbackUnsub = onSnapshot(
          ledgerColRef, 
          (snap) => {
            const logs: CommittedExecutionLog[] = [];
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              logs.push({
                id: docSnap.id,
                action_type: data.action_type || 'UNKNOWN_ACTION',
                target_id: data.target_id || '',
                account_id: data.account_id,
                timestamp: data.timestamp || new Date().toLocaleTimeString(),
                amountUSD: data.amountUSD,
                amountINR: data.amountINR,
                percentage: data.percentage,
                feeUSD: data.feeUSD,
                feeINR: data.feeINR,
                citation: data.citation || '',
                txHash: data.txHash || `TXN-${docSnap.id.slice(0, 6)}`,
                details: data.details || '',
                documentName: data.documentName,
                tierLevel: data.tierLevel,
                operatorEmail: data.operatorEmail || (data.operatorUid ? `${data.operatorUid}@internal` : 'operator@aegisops.internal'),
                status: data.status || 'COMMITTED',
                voidedAt: data.voidedAt,
                voidReason: data.voidReason,
                voidedBy: data.voidedBy,
                batchId: data.batchId,
                createdAt: data.createdAt
              });
            });
            logs.sort((a: any, b: any) => ((b.createdAt || b.id) > (a.createdAt || a.id) ? 1 : -1));
            
            if (snap.docs.length > 0) {
              firestoreBillingTracker.recordOperation(
                'READ',
                'ledger_entries',
                snap.docs.length,
                `fallback query sync received ${snap.docs.length} entries`
              );
            }

            onUpdate(logs.slice(0, maxEntries));
          },
          (fallbackErr) => {
            console.warn('Firestore fallback onSnapshot note:', fallbackErr.message);
          }
        );
        return fallbackUnsub;
      } catch (fallbackEx) {
        console.warn('Firestore fallback subscription exception:', fallbackEx);
      }
    }
  );
}

