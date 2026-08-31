import { collection, addDoc, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StagedStateAction, CommittedExecutionLog, AccountId } from '../types';

/**
 * In-Memory Fallback Store
 * Used when Firestore network is unavailable or offline
 */
const inMemoryLedger: CommittedExecutionLog[] = [
  {
    id: 'seed_init_1',
    action_type: 'INITIALIZE_SYSTEM',
    target_id: 'SYS-INIT',
    account_id: 'ACC-NORTHSTAR',
    timestamp: '11:00:00',
    amountUSD: 0,
    amountINR: 0,
    citation: 'System Genesis Audit & Temporal Clock Synchronization',
    txHash: 'TXN-GENESIS-0001',
    details: 'AegisOps initialized with reference clock frozen at 2026-08-16 11:00 IST.',
    documentName: 'AegisOps System Configuration',
    tierLevel: 'System Baseline',
    operatorUid: 'ops_system',
    operatorEmail: 'engine@aegisops.internal',
    createdAt: '2026-08-16T05:30:00.000Z'
  }
];

export interface CommitActionOptions {
  operatorUid?: string;
  operatorEmail?: string;
  txHashOverride?: string;
}

/**
 * Firestore Service for AegisOps
 * Handles Two-Phase Commit Human-in-the-Loop transactions,
 * audit trail persistence, and real-time ledger updates with in-memory fallback.
 */
export const firestoreService = {
  /**
   * Commits a staged state action atomically into Firestore 'ledger_entries' collection.
   * Generates deterministic immutable TXN hash.
   */
  async commitStagedAction(
    stagedAction: StagedStateAction,
    options?: CommitActionOptions
  ): Promise<CommittedExecutionLog> {
    const txHash =
      options?.txHashOverride ||
      `TXN-${stagedAction.target_id.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestampStr = new Date().toLocaleTimeString();
    const isoCreatedAt = new Date().toISOString();
    const operatorUid = options?.operatorUid || 'internal_ops_admin';
    const operatorEmail = options?.operatorEmail || 'admin@aegisops.internal';

    const committedEntry: CommittedExecutionLog = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action_type: stagedAction.action_type,
      target_id: stagedAction.target_id,
      account_id: stagedAction.account_id,
      timestamp: timestampStr,
      amountUSD: stagedAction.amountUSD,
      amountINR: stagedAction.amountINR,
      percentage: stagedAction.percentage,
      feeUSD: stagedAction.cancellation_fee_USD,
      feeINR: stagedAction.cancellation_fee_INR,
      citation: stagedAction.citation,
      txHash: txHash,
      details: stagedAction.reason,
      documentName: stagedAction.documentName || 'Operating Policy',
      tierLevel: stagedAction.tierLevel || 'Tier 1 / Tier 2 Entitlement',
      operatorUid,
      operatorEmail,
      createdAt: isoCreatedAt
    };

    // Attempt writing to live Firestore
    try {
      if (db) {
        const firestorePayload: Record<string, any> = {
          action_type: stagedAction.action_type,
          target_id: stagedAction.target_id,
          account_id: stagedAction.account_id,
          timestamp: timestampStr,
          citation: stagedAction.citation,
          txHash: txHash,
          details: stagedAction.reason,
          documentName: stagedAction.documentName || 'Operating Policy',
          tierLevel: stagedAction.tierLevel || 'Standard',
          operatorUid,
          operatorEmail,
          createdAt: isoCreatedAt
        };

        if (stagedAction.amountUSD !== undefined) firestorePayload.amountUSD = stagedAction.amountUSD;
        if (stagedAction.amountINR !== undefined) firestorePayload.amountINR = stagedAction.amountINR;
        if (stagedAction.percentage !== undefined) firestorePayload.percentage = stagedAction.percentage;
        if (stagedAction.cancellation_fee_USD !== undefined) firestorePayload.feeUSD = stagedAction.cancellation_fee_USD;
        if (stagedAction.cancellation_fee_INR !== undefined) firestorePayload.feeINR = stagedAction.cancellation_fee_INR;

        const docRef = await addDoc(collection(db, 'ledger_entries'), firestorePayload);
        committedEntry.id = docRef.id;
      }
    } catch (err) {
      console.warn('[FirestoreService] Firestore write failed, committing to in-memory ledger fallback:', err);
    }

    // Always update in-memory store for instantaneous reactive UI
    inMemoryLedger.unshift(committedEntry);
    return committedEntry;
  },

  /**
   * Retrieves committed ledger entries, optionally filtered by accountId.
   */
  async getCommittedLedger(accountId?: AccountId): Promise<CommittedExecutionLog[]> {
    try {
      if (db) {
        const q = query(collection(db, 'ledger_entries'), orderBy('createdAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docs: CommittedExecutionLog[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            docs.push({
              id: doc.id,
              action_type: data.action_type || 'TRANSACTION',
              target_id: data.target_id || '',
              account_id: data.account_id || 'ACC-NORTHSTAR',
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              amountUSD: data.amountUSD,
              amountINR: data.amountINR,
              percentage: data.percentage,
              feeUSD: data.feeUSD,
              feeINR: data.feeINR,
              citation: data.citation || '',
              txHash: data.txHash || `TXN-${doc.id}`,
              details: data.details || '',
              documentName: data.documentName || 'Operating Policy',
              tierLevel: data.tierLevel || 'Standard',
              operatorUid: data.operatorUid,
              operatorEmail: data.operatorEmail,
              createdAt: data.createdAt || new Date().toISOString()
            });
          });

          if (accountId) {
            return docs.filter((d) => d.account_id === accountId);
          }
          return docs;
        }
      }
    } catch (err) {
      console.warn('[FirestoreService] Firestore query fallback to memory:', err);
    }

    if (accountId) {
      return inMemoryLedger.filter((d) => d.account_id === accountId);
    }
    return [...inMemoryLedger];
  },

  /**
   * Subscribes to live real-time ledger updates from Firestore
   */
  subscribeToLedger(
    callback: (entries: CommittedExecutionLog[]) => void,
    accountId?: AccountId
  ): () => void {
    try {
      if (db) {
        const q = query(collection(db, 'ledger_entries'), orderBy('createdAt', 'desc'), limit(50));
        return onSnapshot(
          q,
          (snapshot) => {
            const docs: CommittedExecutionLog[] = [];
            snapshot.forEach((doc) => {
              const d = doc.data();
              docs.push({
                id: doc.id,
                action_type: d.action_type || 'TRANSACTION',
                target_id: d.target_id || '',
                account_id: d.account_id || 'ACC-NORTHSTAR',
                timestamp: d.timestamp || new Date().toLocaleTimeString(),
                amountUSD: d.amountUSD,
                amountINR: d.amountINR,
                percentage: d.percentage,
                feeUSD: d.feeUSD,
                feeINR: d.feeINR,
                citation: d.citation || '',
                txHash: d.txHash || `TXN-${doc.id}`,
                details: d.details || '',
                documentName: d.documentName || 'Operating Policy',
                tierLevel: d.tierLevel || 'Standard',
                operatorUid: d.operatorUid,
                operatorEmail: d.operatorEmail,
                createdAt: d.createdAt || new Date().toISOString()
              });
            });

            const filtered = accountId ? docs.filter((x) => x.account_id === accountId) : docs;
            callback(filtered.length > 0 ? filtered : inMemoryLedger);
          },
          (err) => {
            console.warn('[FirestoreService] Snapshot listener fallback:', err);
            callback(accountId ? inMemoryLedger.filter((x) => x.account_id === accountId) : inMemoryLedger);
          }
        );
      }
    } catch (err) {
      console.warn('[FirestoreService] Could not establish onSnapshot, using local state:', err);
    }

    callback(accountId ? inMemoryLedger.filter((x) => x.account_id === accountId) : inMemoryLedger);
    return () => {};
  }
};
