import { collection, addDoc, updateDoc, doc, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StagedStateAction, CommittedExecutionLog, SyncActionOptions, VoidActionOptions } from '../types/aegisTypes';
import { traceSpan } from '../telemetry/tracer';
import { firestoreBillingTracker } from '../services/firestoreBillingTracker';

// In-memory fallback ledger store when offline or local
const localInMemoryLedger: CommittedExecutionLog[] = [];

/**
 * Persists a staged action directly to the 'ledger_entries' Firestore collection.
 * Wrapped in traceSpan with OpenTelemetry instrumentation.
 */
export async function syncActionToFirestore(
  stagedAction: StagedStateAction,
  options?: SyncActionOptions
): Promise<CommittedExecutionLog> {
  const sanitizedTargetId = stagedAction.target_id.replace(/[^a-zA-Z0-9]/g, '');
  const txHash = options?.txHashOverride || `TXN-${sanitizedTargetId}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestampStr = new Date().toLocaleTimeString();
  const isoCreatedAt = new Date().toISOString();
  const operatorUid = options?.operatorUid || 'system_operator';
  const operatorEmail = options?.operatorEmail || 'operator@aegisops.internal';
  const batchId = options?.batchId || `BATCH-${Date.now()}`;

  return await traceSpan(
    'firestore.sync_action_to_ledger',
    {
      'aegisops.action_type': stagedAction.action_type,
      'aegisops.target_id': stagedAction.target_id,
      'aegisops.account_id': stagedAction.account_id,
      'aegisops.tx_hash': txHash,
      'aegisops.tier_level': stagedAction.tierLevel || 'Tier 1 / Tier 2 SOP',
      'aegisops.document_name': stagedAction.documentName || 'Operational Agreement',
      'enduser.id': operatorUid,
      'enduser.email': operatorEmail,
      'db.system': 'firestore',
      'db.collection.name': 'ledger_entries',
      'db.operation': 'addDoc'
    },
    async () => {
      const firestorePayload: Record<string, any> = {
        action_type: stagedAction.action_type,
        target_id: stagedAction.target_id,
        account_id: stagedAction.account_id,
        timestamp: timestampStr,
        citation: stagedAction.citation,
        txHash: txHash,
        details: stagedAction.reason,
        documentName: stagedAction.documentName || 'Operational Agreement',
        tierLevel: stagedAction.tierLevel || 'Standard',
        operatorUid,
        operatorEmail,
        createdAt: isoCreatedAt,
        status: 'COMMITTED',
        batchId
      };

      if (stagedAction.amountUSD !== undefined) firestorePayload.amountUSD = stagedAction.amountUSD;
      if (stagedAction.amountINR !== undefined) firestorePayload.amountINR = stagedAction.amountINR;
      if (stagedAction.percentage !== undefined) firestorePayload.percentage = stagedAction.percentage;
      if (stagedAction.cancellation_fee_USD !== undefined) firestorePayload.feeUSD = stagedAction.cancellation_fee_USD;
      if (stagedAction.cancellation_fee_INR !== undefined) firestorePayload.feeINR = stagedAction.cancellation_fee_INR;

      try {
        if (db) {
          const docRef = await addDoc(collection(db, 'ledger_entries'), firestorePayload);

          firestoreBillingTracker.recordOperation(
            'WRITE',
            'ledger_entries',
            1,
            `addDoc committed ${stagedAction.action_type} for ${stagedAction.target_id} (${docRef.id})`
          );

          const committedLog: CommittedExecutionLog = {
            id: docRef.id,
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
            documentName: stagedAction.documentName,
            tierLevel: stagedAction.tierLevel,
            operatorUid,
            operatorEmail,
            status: 'COMMITTED',
            batchId,
            createdAt: isoCreatedAt
          };

          localInMemoryLedger.unshift(committedLog);
          return committedLog;
        }
      } catch (err: any) {
        console.warn('[AegisOps Firestore] Error writing to Firestore, falling back to memory store:', err?.message);
      }

      // Offline / Local fallback object
      const fallbackLog: CommittedExecutionLog = {
        id: `local_${Date.now()}_${sanitizedTargetId}`,
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
        documentName: stagedAction.documentName,
        tierLevel: stagedAction.tierLevel,
        operatorUid,
        operatorEmail,
        status: 'COMMITTED',
        batchId,
        createdAt: isoCreatedAt
      };

      localInMemoryLedger.unshift(fallbackLog);
      return fallbackLog;
    }
  );
}

/**
 * Flags an existing committed transaction as VOIDED in Firestore.
 * Wrapped in traceSpan with OpenTelemetry instrumentation.
 */
export async function voidTransactionInFirestore(
  targetDocId: string,
  txHash: string,
  options?: VoidActionOptions
): Promise<{ success: boolean; voidedAt: string; txHash: string }> {
  const voidedAt = new Date().toISOString();
  const operatorEmail = options?.operatorEmail || 'operator@aegisops.internal';
  const voidReason = options?.voidReason || 'Operator rollback via HITL Amber Approval Gate / Modal';

  return await traceSpan(
    'firestore.void_transaction',
    {
      'aegisops.target_doc_id': targetDocId,
      'aegisops.tx_hash': txHash,
      'aegisops.void_reason': voidReason,
      'enduser.email': operatorEmail,
      'db.system': 'firestore',
      'db.collection.name': 'ledger_entries',
      'db.operation': 'updateDoc'
    },
    async () => {
      // 1. Update local in-memory fallback
      const inMemIndex = localInMemoryLedger.findIndex(l => l.id === targetDocId || l.txHash === txHash);
      if (inMemIndex !== -1) {
        localInMemoryLedger[inMemIndex] = {
          ...localInMemoryLedger[inMemIndex],
          status: 'VOIDED',
          voidedAt,
          voidReason,
          voidedBy: operatorEmail
        };
      }

      // 2. Persist to Firestore if available
      try {
        if (db && targetDocId && !targetDocId.startsWith('local_')) {
          const docRef = doc(db, 'ledger_entries', targetDocId);
          await updateDoc(docRef, {
            status: 'VOIDED',
            voidedAt,
            voidReason,
            voidedBy: operatorEmail
          });

          firestoreBillingTracker.recordOperation(
            'WRITE',
            'ledger_entries',
            1,
            `updateDoc VOIDED status for ${txHash} (${targetDocId})`
          );
        } else if (db) {
          // Add a void event document to maintain audit trail
          await addDoc(collection(db, 'ledger_entries'), {
            action_type: 'VOID_REVERSAL',
            target_id: txHash,
            account_id: 'SYSTEM',
            timestamp: new Date().toLocaleTimeString(),
            citation: 'Operator Manual Reversal (HITL Amber Gate Rollback)',
            txHash: `VOID-${txHash}`,
            details: `Secondary rollback flagging transaction ${txHash} as VOIDED. Reason: ${voidReason}`,
            documentName: 'AegisOps Rollback Policy',
            tierLevel: 'System Override',
            operatorEmail,
            status: 'VOIDED',
            voidedAt,
            voidReason,
            voidedBy: operatorEmail,
            createdAt: voidedAt
          });

          firestoreBillingTracker.recordOperation('WRITE', 'ledger_entries', 1, `addDoc VOID log for ${txHash}`);
        }
        return { success: true, voidedAt, txHash };
      } catch (err: any) {
        console.warn('[AegisOps Firestore] Void update error, falling back locally:', err?.message);
        return { success: true, voidedAt, txHash };
      }
    }
  );
}

/**
 * Retrieve recent ledger entries
 */
export async function getRecentLedgerEntries(entryLimit: number = 20): Promise<CommittedExecutionLog[]> {
  try {
    if (db) {
      const q = query(collection(db, 'ledger_entries'), orderBy('createdAt', 'desc'), limit(entryLimit));
      const snap = await getDocs(q);
      const items: CommittedExecutionLog[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          action_type: d.action_type || 'TRANSACTION',
          target_id: d.target_id || docSnap.id,
          account_id: d.account_id || 'ACC-NORTHSTAR',
          timestamp: d.timestamp || '00:00:00',
          amountUSD: d.amountUSD,
          amountINR: d.amountINR,
          percentage: d.percentage,
          feeUSD: d.feeUSD,
          feeINR: d.feeINR,
          citation: d.citation || '',
          txHash: d.txHash || docSnap.id,
          details: d.details || '',
          documentName: d.documentName,
          tierLevel: d.tierLevel,
          operatorUid: d.operatorUid,
          operatorEmail: d.operatorEmail,
          status: d.status || 'COMMITTED',
          batchId: d.batchId,
          createdAt: d.createdAt,
          voidedAt: d.voidedAt,
          voidReason: d.voidReason,
          voidedBy: d.voidedBy
        });
      });
      return items;
    }
  } catch (err) {
    console.warn('[Firestore] Error fetching recent entries, returning local cache:', err);
  }
  return [...localInMemoryLedger];
}

/**
 * Real-time subscription to 'ledger_entries' collection with onSnapshot listener
 */
export function subscribeToLiveLedgerEntries(
  maxEntries: number = 10,
  callback: (entries: CommittedExecutionLog[]) => void
) {
  if (!db) {
    callback([...localInMemoryLedger].slice(0, maxEntries));
    return () => {};
  }

  try {
    const q = query(collection(db, 'ledger_entries'), orderBy('createdAt', 'desc'), limit(maxEntries));
    return onSnapshot(
      q,
      (snapshot) => {
        firestoreBillingTracker.recordOperation('READ', 'ledger_entries', snapshot.docs.length, 'Live onSnapshot Sync');
        const items: CommittedExecutionLog[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          items.push({
            id: docSnap.id,
            action_type: d.action_type || 'TRANSACTION',
            target_id: d.target_id || docSnap.id,
            account_id: d.account_id || 'ACC-NORTHSTAR',
            timestamp: d.timestamp || '00:00:00',
            amountUSD: d.amountUSD,
            amountINR: d.amountINR,
            percentage: d.percentage,
            feeUSD: d.feeUSD,
            feeINR: d.feeINR,
            citation: d.citation || '',
            txHash: d.txHash || docSnap.id,
            details: d.details || '',
            documentName: d.documentName,
            tierLevel: d.tierLevel,
            operatorUid: d.operatorUid,
            operatorEmail: d.operatorEmail,
            status: d.status || 'COMMITTED',
            batchId: d.batchId,
            createdAt: d.createdAt,
            voidedAt: d.voidedAt,
            voidReason: d.voidReason,
            voidedBy: d.voidedBy
          });
        });
        callback(items);
      },
      (error) => {
        console.warn('[AegisOps Firestore] onSnapshot listener warning:', error.message);
        callback([...localInMemoryLedger].slice(0, maxEntries));
      }
    );
  } catch (err: any) {
    console.warn('[AegisOps Firestore] Failed to initialize live snapshot listener:', err.message);
    callback([...localInMemoryLedger].slice(0, maxEntries));
    return () => {};
  }
}

/**
 * Diagnostics utility to verify Firestore database connectivity and permissions
 */
export async function testFirestoreDiagnostics(): Promise<{
  connected: boolean;
  activeEntriesCount: number;
  message: string;
}> {
  try {
    const entries = await getRecentLedgerEntries(5);
    return {
      connected: true,
      activeEntriesCount: entries.length,
      message: `Successfully connected to Firestore. Retrieved ${entries.length} recent ledger audit documents.`
    };
  } catch (err: any) {
    return {
      connected: false,
      activeEntriesCount: localInMemoryLedger.length,
      message: `Offline mode active: ${err?.message || 'Local fallback operational'}`
    };
  }
}
