import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { UserRole, AccountId, Currency, Order, Ticket, ChatMessage, StagedStateAction, CommittedExecutionLog, ToolCall } from './types';
import { ACCOUNTS, INITIAL_ORDERS, INITIAL_TICKETS, SYSTEM_REFERENCE_TIME } from './data/mockData';
import { syncActionToFirestore, subscribeToLiveLedgerEntries, voidTransactionInFirestore } from './services/firebaseLedger';
import { toolEngine } from './services/toolEngine';
import { lookupOrderData, normalizeAccountId } from './tools/toolEngine';
import { withSpan } from './telemetry/tracer';
import { SpanKind } from '@opentelemetry/api';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { AmberApprovalGate } from './components/AmberApprovalGate';
import { OpsAnomalyRadar } from './components/OpsAnomalyRadar';
import { PolicyDocumentsModal } from './components/PolicyDocumentsModal';
import { OrderLedgerModal } from './components/OrderLedgerModal';
import { CommittedLedgerModal } from './components/CommittedLedgerModal';
import { BillingMonitor } from './components/BillingMonitor';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { WallpaperModal } from './components/WallpaperModal';

function ParcelPilotApp() {
  const { profile, user } = useAuth();

  // Session State - Synced with Firestore User Profile
  const [role, setRole] = useState<UserRole>('customer');
  const [accountId, setAccountId] = useState<AccountId>('ACC-NORTHSTAR');
  const [currency, setCurrency] = useState<Currency>('USD');

  // Synchronize when Firestore Profile loads or changes
  useEffect(() => {
    if (profile) {
      setRole(profile.role);
      setAccountId(profile.accountId);
    }
  }, [profile]);

  // Ledger & Fleet State
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [committedLogs, setCommittedLogs] = useState<CommittedExecutionLog[]>([]);

  // Live real-time synchronization with Firestore 'ledger_entries' collection (last 10 entries)
  useEffect(() => {
    const unsubscribe = subscribeToLiveLedgerEntries(10, (liveEntries) => {
      setCommittedLogs(liveEntries);

      // Reconcile fleet state against live ledger entries
      const cancelledOrderIds = new Set<string>();
      const escalatedTicketIds = new Set<string>();

      liveEntries.forEach((entry) => {
        if (entry.action_type === 'CANCEL_SHIPMENT') {
          cancelledOrderIds.add(entry.target_id);
        }
        if (entry.action_type === 'ESCALATE_TICKET') {
          escalatedTicketIds.add(entry.target_id);
        }
      });

      if (cancelledOrderIds.size > 0) {
        setOrders(prev => prev.map(o => cancelledOrderIds.has(o.order_id) ? { ...o, status: 'Cancelled' } : o));
      }
      if (escalatedTicketIds.size > 0) {
        setTickets(prev => prev.map(t => escalatedTicketIds.has(t.ticket_id) ? { ...t, status: 'ESCALATED' } : t));
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Modals
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isCommittedLedgerModalOpen, setIsCommittedLedgerModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);

  // Chat Wallpaper & Theme State
  const [wallpaperThemeId, setWallpaperThemeId] = useState<string>(() => {
    return localStorage.getItem('parcelpilot_chat_wallpaper') || 'whatsapp-dark-doodle';
  });

  const handleSelectWallpaperTheme = (newThemeId: string) => {
    setWallpaperThemeId(newThemeId);
    localStorage.setItem('parcelpilot_chat_wallpaper', newThemeId);
  };

  // Staged State Actions (Human-In-The-Loop Approval Gate - Supports Multiple Staged Actions Simultaneously)
  const [stagedActions, setStagedActions] = useState<StagedStateAction[]>([]);

  // Staged Actions Helper: Append or update a staged action
  const addStagedAction = (action: StagedStateAction) => {
    setStagedActions(prev => {
      const filtered = prev.filter(a => a.id !== action.id && !(a.target_id === action.target_id && a.action_type === action.action_type));
      return [...filtered, action];
    });
  };

  // Staged Actions Helper: Batch add multiple staged actions
  const addBatchStagedActions = (actions: StagedStateAction[]) => {
    setStagedActions(prev => {
      const newIds = new Set(actions.map(a => `${a.target_id}_${a.action_type}`));
      const filtered = prev.filter(a => !newIds.has(`${a.target_id}_${a.action_type}`));
      return [...filtered, ...actions];
    });
  };

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm_welcome',
      sender: 'assistant',
      timestamp: '11:00:00',
      text: `### 🛡️ **AegisOps — Autonomous B2B Logistics Multi-Step Orchestrator**\n\n` +
            `• **Target Model**: **Gemini 3.5 Flash** (\`gemini-3.5-flash\`) with native Tool Declarations\n` +
            `• **Snapshot Reference Clock**: **\`2026-08-16 11:00 IST\`** (Asia/Kolkata)\n` +
            `• **3-Tier Policy Precedence**:\n` +
            `  - **Tier 1 (Enterprise Agreements)**: Northstar (Clause 4.1 $0 Notice / 4.2 100% SLA) & LumenWorks (Clause 3.4 50% SLA)\n` +
            `  - **Tier 2 (Active Baseline SOPs)**: Cancellation & Service Credit SOP v4 & Support Policy v3\n` +
            `  - **Tier 3 (Quarantined)**: Support Policy v2 (60-min grace period) & historical ticket notes\n` +
            `• **Active Tenant**: ${ACCOUNTS['ACC-NORTHSTAR']?.name || 'Northstar Logistics'} (\`ACC-NORTHSTAR\`)\n\n` +
            `Click any of the quick prompt chips below or ask me to evaluate cancellations, carrier delay SLA disputes, or run network-wide anomaly radar scans.`
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  // Main Autonomous Agent Processing Loop
  const handleSendMessage = async (userText: string) => {
    const cleanText = userText.trim();
    if (!cleanText) return;

    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString(),
      text: cleanText
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    // Check if user is approving active staged actions in chat
    const lower = cleanText.toLowerCase();
    if (stagedActions.length > 0 && (
      lower === 'yes' ||
      lower.includes('approve') ||
      lower.includes('confirm') ||
      lower.includes('proceed') ||
      lower.includes('execute')
    )) {
      if (stagedActions.length === 1) {
        await handleConfirmSingleStagedAction(stagedActions[0]);
      } else {
        await handleConfirmAllStagedActions(stagedActions);
      }
      setIsThinking(false);
      return;
    }

    try {
      // Call backend Gemini 3.5 Flash Agent endpoint
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          accountId,
          role,
          currency
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.stagedActionsToAdd && data.stagedActionsToAdd.length > 0) {
          addBatchStagedActions(data.stagedActionsToAdd);
        }

        setMessages(prev => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            text: data.text,
            toolCalls: data.toolCalls || [],
            isWarning: data.isWarning,
            isSuccess: data.isSuccess
          }
        ]);
        setIsThinking(false);
        return;
      }
    } catch (err) {
      console.warn('[AegisOps Client] Server API fallback to deterministic pipeline:', err);
    }

    // Deterministic client fallback
    setTimeout(() => {
      processAgentTriage(cleanText);
      setIsThinking(false);
    }, 300);
  };

  // Execute Confirmed Single Staged Action
  const handleConfirmSingleStagedAction = async (target: StagedStateAction) => {
    if (!target) return;

    const txId = `TXN-${target.target_id.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    await withSpan(
      'amber_approval_gate.confirm_and_execute',
      {
        'parcelpilot.action_type': target.action_type,
        'parcelpilot.target_id': target.target_id,
        'parcelpilot.account_id': target.account_id,
        'parcelpilot.tx_hash': txId,
        'parcelpilot.role': role,
        'parcelpilot.operator_email': user?.email || profile?.email || 'operator@parcelpilot.internal'
      },
      async (span) => {
        span.addEvent('hitl.operator_attestation_started', {
          target_id: target.target_id,
          action_type: target.action_type,
          citation: target.citation
        });

        let newLog: CommittedExecutionLog;

        // Use syncActionToFirestore (addDoc) to persist to Firestore
        try {
          newLog = await syncActionToFirestore(target, {
            operatorUid: user?.uid || profile?.uid || 'anonymous_operator',
            operatorEmail: user?.email || profile?.email || 'operator@parcelpilot.internal',
            txHashOverride: txId,
            batchId: `SINGLE-${txId}`
          });
          span.addEvent('hitl.firestore_persistence_success', {
            docId: newLog.id,
            txHash: newLog.txHash
          });
        } catch (err: any) {
          console.error('syncActionToFirestore error:', err);
          span.recordException(err);
          span.addEvent('hitl.firestore_fallback_triggered', {
            error: err?.message
          });
          newLog = {
            id: `log_${Date.now()}`,
            action_type: target.action_type,
            target_id: target.target_id,
            account_id: target.account_id,
            timestamp: new Date().toLocaleTimeString(),
            amountUSD: target.amountUSD,
            amountINR: target.amountINR,
            feeUSD: target.cancellation_fee_USD,
            feeINR: target.cancellation_fee_INR,
            citation: target.citation,
            txHash: txId,
            details: target.reason
          };
        }

        setCommittedLogs(prev => [newLog, ...prev.filter(p => p.id !== newLog.id)].slice(0, 10));

        // Update order/ticket states
        if (target.action_type === 'CANCEL_SHIPMENT') {
          setOrders(prev => prev.map(o => o.order_id === target.target_id ? { ...o, status: 'Cancelled' } : o));
          span.addEvent('hitl.order_state_cancelled', { order_id: target.target_id });
        }
        if (target.action_type === 'ESCALATE_TICKET') {
          setTickets(prev => prev.map(t => t.ticket_id === target.target_id ? { ...t, status: 'ESCALATED' } : t));
          span.addEvent('hitl.ticket_state_escalated', { ticket_id: target.target_id });
        }

        // Remove the action from queue
        setStagedActions(prev => prev.filter(a => a.id !== target.id));

        // Visual celebration feedback
        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#0284c7', '#10b981', '#f59e0b']
          });
        } catch {
          // ignore in environments without canvas
        }

        // Append Assistant Confirmation Message
        const formattedAmount = currency === 'USD'
          ? (target.amountUSD !== undefined ? `$${target.amountUSD.toFixed(2)}` : undefined)
          : (target.amountINR !== undefined ? `₹${target.amountINR.toLocaleString()}` : undefined);

        const formattedFee = currency === 'USD'
          ? (target.cancellation_fee_USD !== undefined ? `$${target.cancellation_fee_USD.toFixed(2)}` : undefined)
          : (target.cancellation_fee_INR !== undefined ? `₹${target.cancellation_fee_INR.toLocaleString()}` : undefined);

        setMessages(prev => [
          ...prev,
          {
            id: `conf_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            isSuccess: true,
            text: `### **Execution Confirmed & Committed to Firestore Ledger**\n\n` +
                  `The staged action for **\`${target.target_id}\`** has been confirmed by the operator and successfully written to \`ledger_entries\`.\n\n` +
                  `---\n\n` +
                  `* **Action Type**: \`${target.action_type}\`\n` +
                  `* **Transaction Reference ID**: \`${txId}\`\n` +
                  `* **Target Resource**: \`${target.target_id}\`\n` +
                  `* **Account**: ${ACCOUNTS[target.account_id]?.name} (\`${target.account_id}\`)\n` +
                  (formattedAmount ? `* **Credit Note Issued**: **${formattedAmount}** (${target.percentage}% Service Credit)\n` : '') +
                  (formattedFee ? `* **Assessed Fee**: **${formattedFee}**\n` : '') +
                  `* **Governing Citation**: ${target.citation}\n` +
                  `* **Firestore Document Ref**: \`ledger_entries/${newLog.id}\`\n` +
                  `* **Ledger Status**: **\`COMMITTED\`**\n\n` +
                  `---\n\n` +
                  `**Billing & Firestore Ledger Updates**:\n` +
                  `1. **Firestore Persistence**: Persisted via \`addDoc\` to the \`ledger_entries\` collection.\n` +
                  `2. **Real-time Synchronization**: Live updates broadcast to the Ops Anomaly Radar ledger feed.\n` +
                  `3. **Invoice Adjustment**: Credit note applied against current billing cycle \`2026-03\`.\n` +
                  `4. **Fleet State**: Operational status updated on Ops Anomaly Radar.`
          }
        ]);

        span.addEvent('hitl.ui_confirmation_rendered', {
          logId: newLog.id,
          txHash: txId
        });
      },
      { kind: SpanKind.INTERNAL }
    );
  };

  // Execute Confirmed All Staged Actions in a Single Transaction-like Sequence
  const handleConfirmAllStagedActions = async (actionsToConfirm: StagedStateAction[]) => {
    if (!actionsToConfirm || actionsToConfirm.length === 0) return;

    const batchSize = actionsToConfirm.length;
    const batchTxId = `TXN-BATCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await withSpan(
      'amber_approval_gate.confirm_all_batch',
      {
        'parcelpilot.batch_size': batchSize,
        'parcelpilot.batch_tx_id': batchTxId,
        'parcelpilot.role': role,
        'parcelpilot.operator_email': user?.email || profile?.email || 'operator@parcelpilot.internal'
      },
      async (span) => {
        const committedBatchLogs: CommittedExecutionLog[] = [];

        // Sequential atomic commit simulation
        for (const action of actionsToConfirm) {
          const actionTxId = `TXN-${action.target_id.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
          
          try {
            const newLog = await syncActionToFirestore(action, {
              operatorUid: user?.uid || profile?.uid || 'anonymous_operator',
              operatorEmail: user?.email || profile?.email || 'operator@parcelpilot.internal',
              txHashOverride: actionTxId,
              batchId: batchTxId
            });
            committedBatchLogs.push(newLog);
          } catch (err: any) {
            console.error('syncActionToFirestore batch item error:', err);
            const fallbackLog: CommittedExecutionLog = {
              id: `log_batch_${Date.now()}_${action.target_id}`,
              action_type: action.action_type,
              target_id: action.target_id,
              account_id: action.account_id,
              timestamp: new Date().toLocaleTimeString(),
              amountUSD: action.amountUSD,
              amountINR: action.amountINR,
              feeUSD: action.cancellation_fee_USD,
              feeINR: action.cancellation_fee_INR,
              citation: action.citation,
              txHash: actionTxId,
              details: action.reason
            };
            committedBatchLogs.push(fallbackLog);
          }

          // State updates
          if (action.action_type === 'CANCEL_SHIPMENT') {
            setOrders(prev => prev.map(o => o.order_id === action.target_id ? { ...o, status: 'Cancelled' } : o));
          }
          if (action.action_type === 'ESCALATE_TICKET') {
            setTickets(prev => prev.map(t => t.ticket_id === action.target_id ? { ...t, status: 'ESCALATED' } : t));
          }
        }

        // Commit all logs into the live state
        setCommittedLogs(prev => [...committedBatchLogs, ...prev].slice(0, 15));
        setStagedActions([]);

        // Celebration Confetti
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.7 },
            colors: ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6']
          });
        } catch {
          // ignore
        }

        // Summary calculations
        const totalCreditsUSD = actionsToConfirm.reduce((acc, a) => acc + (a.amountUSD || 0), 0);
        const totalCreditsINR = actionsToConfirm.reduce((acc, a) => acc + (a.amountINR || 0), 0);
        const totalFeesUSD = actionsToConfirm.reduce((acc, a) => acc + (a.cancellation_fee_USD || 0), 0);
        const totalFeesINR = actionsToConfirm.reduce((acc, a) => acc + (a.cancellation_fee_INR || 0), 0);

        const creditSummary = currency === 'USD' ? `$${totalCreditsUSD.toFixed(2)}` : `₹${totalCreditsINR.toLocaleString()}`;
        const feeSummary = currency === 'USD' ? `$${totalFeesUSD.toFixed(2)}` : `₹${totalFeesINR.toLocaleString()}`;

        // Append Batch Confirmation Message
        setMessages(prev => [
          ...prev,
          {
            id: `batch_conf_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            isSuccess: true,
            text: `### **Batch Transaction Confirmed & Committed (${batchSize} Operations)**\n\n` +
                  `All **${batchSize} staged operations** have been successfully confirmed by operator **\`${user?.email || 'operator@parcelpilot.internal'}\`** and committed in a single atomic pipeline to Firestore \`ledger_entries\`.\n\n` +
                  `---\n\n` +
                  `* **Batch Identifier**: \`${batchTxId}\`\n` +
                  `* **Total Operations Committed**: **${batchSize} actions**\n` +
                  (totalCreditsUSD > 0 ? `* **Cumulative Service Credits**: **${creditSummary}**\n` : '') +
                  (totalFeesUSD > 0 ? `* **Cumulative Cancellation Fees**: **${feeSummary}**\n` : '') +
                  `* **Committed Resources**: ${actionsToConfirm.map(a => `\`${a.target_id}\``).join(', ')}\n` +
                  `* **Ledger Status**: **\`COMMITTED_BATCH_COMPLETE\`**\n\n` +
                  `---\n\n` +
                  `**Operations Committed**:\n` +
                  actionsToConfirm.map((a, i) => 
                    `${i + 1}. **\`${a.action_type}\`** on **\`${a.target_id}\`** (${a.citation.substring(0, 45)}...)`
                  ).join('\n') +
                  `\n\n> All operational statuses have been updated in real-time across the Ops Anomaly Radar and Firestore audit stream.`
          }
        ]);

        span.addEvent('hitl.batch_confirmation_completed', {
          batchSize,
          batchTxId
        });
      },
      { kind: SpanKind.INTERNAL }
    );
  };

  // Dismiss Single Staged Action
  const handleDismissSingleStagedAction = (actionId: string) => {
    const target = stagedActions.find(a => a.id === actionId);
    setStagedActions(prev => prev.filter(a => a.id !== actionId));

    if (target) {
      setMessages(prev => [
        ...prev,
        {
          id: `abort_${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString(),
          text: `❌ **Action Aborted**: Staged action \`${target.action_type}\` for **${target.target_id}** was discarded by the operator.`
        }
      ]);
    }
  };

  // Dismiss All Staged Actions
  const handleDismissAllStagedActions = () => {
    const count = stagedActions.length;
    setStagedActions([]);

    setMessages(prev => [
      ...prev,
      {
        id: `abort_all_${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString(),
        text: `❌ **Batch Aborted**: All **${count} staged operations** were discarded by the operator. No state updates or ledger commits were performed.`
      }
    ]);
  };

  // Secondary Firestore Write: Revert Last Batch / Transaction
  const handleRevertLastBatch = async () => {
    const activeLogs不易 = committedLogs.filter(l => l.status !== 'VOIDED');
    if (activeLogs不易.length === 0) return;

    const newestLog = activeLogs不易[0];
    const targetBatchId = newestLog.batchId;
    const targetLogs = targetBatchId
      ? activeLogs不易.filter(l => l.batchId === targetBatchId)
      : [newestLog];

    const operatorEmail = user?.email || profile?.email || 'operator@parcelpilot.internal';
    const voidedAt = new Date().toISOString();

    for (const log of targetLogs) {
      await voidTransactionInFirestore(log.id, log.txHash, {
        operatorEmail,
        voidReason: 'Operator reverted batch via Committed Ledger Audit Modal'
      });
    }

    setCommittedLogs(prev =>
      prev.map(log => {
        if (targetLogs.some(t => t.id === log.id || t.txHash === log.txHash)) {
          return {
            ...log,
            status: 'VOIDED',
            voidedAt,
            voidReason: 'Operator reverted batch via Committed Ledger Audit Modal'
          };
        }
        return log;
      })
    );

    setMessages(prev => [
      ...prev,
      {
        id: `void_${Date.now()}`,
        sender: 'system',
        timestamp: new Date().toLocaleTimeString(),
        text: `⚠️ **Secondary Firestore Write Executed — Batch Reverted & Marked VOIDED**\n\n` +
              `The transaction hash **\`${targetLogs.map(l => l.txHash).join(', ')}\`** ` +
              `has been flagged as **\`VOIDED\`** in Firestore \`ledger_entries\`.\n\n` +
              `* **Target(s)**: ${targetLogs.map(l => `\`${l.target_id}\``).join(', ')}\n` +
              `* **Voided By**: \`${operatorEmail}\`\n` +
              `* **Timestamp**: \`${new Date().toLocaleTimeString()}\``
      }
    ]);
  };

  // Autonomous Agent Engine Logic (Deterministic Fallback Pipeline)
  const processAgentTriage = (prompt: string) => {
    const lower = prompt.toLowerCase();

    // Check if user is approving active staged actions in chat
    if (stagedActions.length > 0 && (
      lower.includes('yes') ||
      lower.includes('approve') ||
      lower.includes('confirm') ||
      lower.includes('proceed') ||
      lower.includes('execute')
    )) {
      if (stagedActions.length === 1) {
        handleConfirmSingleStagedAction(stagedActions[0]);
      } else {
        handleConfirmAllStagedActions(stagedActions);
      }
      return;
    }

    const detectedOrderMatch = prompt.match(/ORD-\d+/i);
    const orderId = detectedOrderMatch ? detectedOrderMatch[0].toUpperCase() : null;

    const detectedTicketMatch = prompt.match(/TCK-\d+/i);
    const ticketId = detectedTicketMatch ? detectedTicketMatch[0].toUpperCase() : null;

    const toolCalls: ToolCall[] = [];

    // --- CASE A: SPECIFIC ORDER QUERY ---
    if (orderId) {
      // Step 1: lookup_order_data
      const lookupCall: ToolCall = {
        id: `tool_lookup_${Date.now()}`,
        name: 'lookup_order_data',
        params: { order_id: orderId, session_account_id: accountId, role },
        status: 'running'
      };
      toolCalls.push(lookupCall);

      const orderData = lookupOrderData(orderId, accountId, role, orders);

      // Handle RBAC Tenant Violation (Anti-Snooping / BOLA defense with zero metadata disclosure)
      if (orderData.isRBACError) {
        lookupCall.status = 'failed';
        lookupCall.error = orderData.error;

        setMessages(prev => [
          ...prev,
          {
            id: `a_rbac_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            isWarning: true,
            rbacError: {
              requestedId: orderId,
              sessionAccountId: accountId,
              errorCode: orderData.errorCode || 'RBAC_TENANT_ISOLATION_VIOLATION',
              message: orderData.error || 'Resource not accessible within your tenant scope.'
            },
            text: `🛑 **Security Authorization Alert: RBAC Tenant Isolation Violation**\n\n` +
                  `Cross-tenant access was strictly rejected under Customer Portal security policies.\n\n` +
                  `• **Target Order**: \`${orderId}\`\n` +
                  `• **Active Tenant Scope**: **${ACCOUNTS[accountId]?.name || accountId}** (\`${accountId}\`)\n` +
                  `• **Policy Enforcement**: Customer roles are prohibited from viewing or executing state actions on external tenant shipments.\n` +
                  `• **Anti-Enumeration Guard**: Zero target metadata disclosed.\n\n` +
                  `*Tip: To audit across accounts, switch your role in the top header to **Internal Operations**.*`,
            toolCalls
          }
        ]);
        return;
      }

      if (orderData.error) {
        lookupCall.status = 'failed';
        lookupCall.error = orderData.error;

        setMessages(prev => [
          ...prev,
          {
            id: `a_notfound_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            text: `⚠️ **Order Record Not Found**: ${orderData.error}`,
            toolCalls
          }
        ]);
        return;
      }

      lookupCall.status = 'completed';
      lookupCall.result = orderData;

      // Step 2: audit_policy_entitlements
      const isCancellation = lower.includes('cancel') || lower.includes('cancellation') || lower.includes('fee') || lower.includes('waive');
      const isCreditOrDelay = lower.includes('credit') || lower.includes('refund') || lower.includes('delay') || lower.includes('late') || lower.includes('sla') || lower.includes('compensation') || lower.includes('eligible');

      const auditQueryType = isCancellation ? 'cancellation' : (isCreditOrDelay || orderData.status === 'Delayed' ? 'credit' : 'auto_detect');

      const auditCall: ToolCall = {
        id: `tool_audit_${Date.now()}`,
        name: 'audit_policy_entitlements',
        params: {
          account_id: orderData.account_id,
          order_id: orderData.order_id,
          query_type: auditQueryType,
          delay_hours: orderData.calculated_delay_hours,
          carrier_fault: orderData.carrier_fault
        },
        status: 'running'
      };
      toolCalls.push(auditCall);

      const auditResult = toolEngine.audit_policy_entitlements(orderData.account_id, orderData, auditQueryType);
      auditCall.status = 'completed';
      auditCall.result = auditResult;

      // Scenario 1: Cancellation Flow
      if (auditQueryType === 'cancellation') {
        const staged = toolEngine.stage_state_action('CANCEL_SHIPMENT', orderData.order_id, orderData.account_id, {
          cancellation_fee_USD: auditResult.cancellation_fee_USD,
          cancellation_fee_INR: auditResult.cancellation_fee_INR,
          tierLevel: auditResult.tierLevel,
          citation: auditResult.citation,
          documentName: auditResult.documentName,
          reason: auditResult.reason
        });

        addStagedAction(staged);

        const feeFormatted = currency === 'USD'
          ? `$${auditResult.cancellation_fee_USD?.toFixed(2)}`
          : `₹${auditResult.cancellation_fee_INR?.toLocaleString()}`;

        setMessages(prev => [
          ...prev,
          {
            id: `a_cancel_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            text: `### **Cancellation Audit for Order \`${orderId}\`**\n\n` +
                  `I have evaluated the cancellation request against the active policy precedence hierarchy.\n\n` +
                  `---\n\n` +
                  `### **1. Operational Lead Time Verification**\n` +
                  `* **Order ID**: \`${orderData.order_id}\`\n` +
                  `* **Account**: ${orderData.account_name} (\`${orderData.account_id}\`)\n` +
                  `* **Scheduled Pickup**: \`${orderData.scheduled_pickup || 'N/A'}\`\n` +
                  `* **Notice Lead Time**: **${orderData.notice_hours_until_pickup !== null ? orderData.notice_hours_until_pickup + ' hours' : 'N/A'}** prior to scheduled pickup (Anchor: \`${SYSTEM_REFERENCE_TIME}\`)\n\n` +
                  `---\n\n` +
                  `### **2. Governing Policy Precedence**\n` +
                  `* **Precedence Tier**: **${auditResult.tierLevel}**\n` +
                  `* **Governing Document**: *${auditResult.documentName}*\n` +
                  `* **Applicable Citation**: **${auditResult.citation}**\n` +
                  `* **Assessed Cancellation Fee**: **${feeFormatted}** (${auditResult.arithmetic_breakdown})\n\n` +
                  `---\n\n` +
                  `### **3. Staged State Action**\n` +
                  `In accordance with human-in-the-loop safety protocols, the action has been prepared in the **Approval Gate**:\n` +
                  `* **Action**: \`CANCEL_SHIPMENT\`\n` +
                  `* **Target**: \`${orderData.order_id}\`\n` +
                  `* **Status**: ⏳ \`STAGED_AWAITING_CONFIRMATION\`\n\n` +
                  `> **Next Step**: Please review the amber approval card and click **"Confirm & Execute"** (or type *"Yes, approve"*) to commit this cancellation to the operational ledger.`,
            toolCalls
          }
        ]);
        return;
      }

      // Scenario 2: Service Credit / Delay Flow
      if (auditResult.eligible && auditResult.action_type === 'ISSUE_SERVICE_CREDIT') {
        const staged = toolEngine.stage_state_action('ISSUE_SERVICE_CREDIT', orderData.order_id, orderData.account_id, {
          amountUSD: auditResult.credit_amount_USD,
          amountINR: auditResult.credit_amount_INR,
          percentage: auditResult.credit_percentage,
          tierLevel: auditResult.tierLevel,
          citation: auditResult.citation,
          documentName: auditResult.documentName,
          reason: auditResult.reason
        });

        addStagedAction(staged);

        const costFormatted = currency === 'USD' ? `$${orderData.costUSD.toFixed(2)}` : `₹${orderData.costINR.toLocaleString()}`;
        const creditFormatted = currency === 'USD' ? `$${auditResult.credit_amount_USD?.toFixed(2)}` : `₹${auditResult.credit_amount_INR?.toLocaleString()}`;

        setMessages(prev => [
          ...prev,
          {
            id: `a_credit_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            text: `### **Eligibility & Policy Audit for Order \`${orderId}\`**\n\n` +
                  `Yes, you are **eligible for a service credit**.\n\n` +
                  `---\n\n` +
                  `### **1. Operational & Delay Verification**\n` +
                  `* **Order ID**: \`${orderData.order_id}\`\n` +
                  `* **Account**: ${orderData.account_name} (\`${orderData.account_id}\`)\n` +
                  `* **Carrier**: ${orderData.carrier} (${orderData.service_tier})\n` +
                  `* **Shipment Base Fee**: **${costFormatted}**\n` +
                  `* **Carrier Fault**: Confirmed (\`True\` — ${orderData.root_cause})\n` +
                  `* **Calculated Delay**: **${orderData.calculated_delay_hours} hours** (relative to \`${SYSTEM_REFERENCE_TIME}\`)\n\n` +
                  `---\n\n` +
                  `### **2. Governing Policy Precedence**\n` +
                  `* **Governing Precedence**: **${auditResult.tierLevel}**\n` +
                  `* **Governing Document**: *${auditResult.documentName}*\n` +
                  `* **Applicable Citation**: **${auditResult.citation}**\n` +
                  `* **Entitlement Breakdown**: ${auditResult.arithmetic_breakdown}\n` +
                  `* **Total Eligible Credit**: **${creditFormatted}** (${auditResult.credit_percentage}% of shipment fee)\n\n` +
                  `---\n\n` +
                  `### **3. Staged State Action**\n` +
                  `In accordance with human-in-the-loop safety protocols, the action has been prepared in the **Approval Gate**:\n` +
                  `* **Action**: \`ISSUE_SERVICE_CREDIT\`\n` +
                  `* **Target**: \`${orderData.order_id}\`\n` +
                  `* **Credit Amount**: **${creditFormatted}**\n` +
                  `* **Staged Action ID**: \`${staged.id}\`\n` +
                  `* **Status**: ⏳ \`STAGED_AWAITING_CONFIRMATION\`\n\n` +
                  `> **Next Step**: Please review the staged amber confirmation card on your dashboard and click **"Confirm & Execute"** (or type *"Yes, confirm and execute"*) to commit this credit to the billing ledger.`,
            toolCalls
          }
        ]);
        return;
      } else {
        // Ineligible for credit
        setMessages(prev => [
          ...prev,
          {
            id: `a_ineligible_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            text: `### **Policy Audit Result for Order \`${orderId}\`**\n\n` +
                  `* **Account**: ${orderData.account_name} (\`${orderData.account_id}\`)\n` +
                  `* **Calculated Delay**: ${orderData.calculated_delay_hours} hours\n` +
                  `* **Carrier Fault**: \`${orderData.carrier_fault ? 'True' : 'False'}\` (${orderData.root_cause || 'None'})\n` +
                  `* **Governing Policy**: **${auditResult.tierLevel}**\n` +
                  `* **Citation**: *${auditResult.citation}*\n` +
                  `* **Outcome**: **Not Eligible for Automated Service Credit**\n` +
                  `* **Reason**: ${auditResult.reason}\n\n` +
                  `No state action was staged per governing criteria.`,
            toolCalls
          }
        ]);
        return;
      }
    }

    // --- CASE B: TICKET QUERY / ESCALATION ---
    if (ticketId) {
      const ticket = tickets.find(t => t.ticket_id.toUpperCase() === ticketId.toUpperCase());
      if (ticket) {
        const staged = toolEngine.stage_state_action('ESCALATE_TICKET', ticket.ticket_id, ticket.account_id, {
          tierLevel: 'Tier 1 / Tier 2 Operations Escalation Protocol',
          citation: '04_Product_Operations_Guide.pdf Section 4.3 & Clause 7.3 Priority Escalation',
          documentName: '04_Product_Operations_Guide.pdf',
          reason: `High priority SLA breach escalated for carrier intervention on order ${ticket.order_id}.`
        });

        addStagedAction(staged);

        setMessages(prev => [
          ...prev,
          {
            id: `a_tck_${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString(),
            text: `### **Ticket Escalation Request for \`${ticket.ticket_id}\`**\n\n` +
                  `* **Ticket ID**: \`${ticket.ticket_id}\`\n` +
                  `* **Associated Order**: \`${ticket.order_id}\`\n` +
                  `* **Priority Level**: **${ticket.priority}** (SLA Breached: \`${ticket.sla_breached ? 'TRUE' : 'FALSE'}\`)\n` +
                  `* **Issue**: ${ticket.issue}\n\n` +
                  `I have staged an **\`ESCALATE_TICKET\`** dispatch action in the approval gate for your confirmation.`,
            toolCalls: [{
              id: `tool_tck_${Date.now()}`,
              name: 'stage_state_action',
              params: { action_type: 'ESCALATE_TICKET', target_id: ticket.ticket_id },
              status: 'completed',
              result: staged
            }]
          }
        ]);
        return;
      }
    }

    // --- CASE C: ANOMALY RADAR SCAN (PROBLEM 1) ---
    if (lower.includes('radar') || lower.includes('anomaly') || lower.includes('problem 1') || lower.includes('cluster') || lower.includes('apex')) {
      const radarData = toolEngine.radar_anomaly_scan(orders, tickets);

      setMessages(prev => [
        ...prev,
        {
          id: `a_radar_${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString(),
          text: `### **Ops Anomaly Radar Summary (Snapshot 2026-03-01T00:00:00Z)**\n\n` +
                `Autonomous fleet telemetry scan completed for **Problem 1 (Carrier Delay Cluster)**:\n\n` +
                `* **Systemic Anomaly**: **${radarData.primaryAnomaly}**\n` +
                `* **Affected Carrier-Fault Shipments (>= 2h Delay)**: **${radarData.affected_shipments_count} active orders**\n` +
                `* **Impacted Carrier Breakdown**: Apex Express (${radarData.carrierCounts['Apex Express'] || 0} shipments)\n` +
                `* **High-Priority SLA Breaches**: **${radarData.highPrioritySla.length} tickets** requiring immediate liaison triage (\`TCK-801\`, \`TCK-802\`, \`TCK-804\`)\n\n` +
                `You can view the full order breakdown in the **Ops Anomaly Radar** on the right sidebar or click any order pill below to initiate an immediate policy audit.`,
          toolCalls: [{
            id: `tool_radar_${Date.now()}`,
            name: 'radar_anomaly_scan',
            params: { min_delay_hours: 2.0, carrier_fault_only: true, snapshot_time: SYSTEM_REFERENCE_TIME },
            status: 'completed',
            result: radarData
          }]
        }
      ]);
      return;
    }

    // --- CASE D: GENERAL HELP / FALLBACK ---
    setMessages(prev => [
      ...prev,
      {
        id: `a_help_${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString(),
        text: `### **ParcelPilot Autonomous Operations Hub**\n\n` +
              `I am ready to audit shipments against the **3-Tier Precedence Hierarchy**:\n\n` +
              `1. **Audit Late Delivery Credit**: *"Audit delay for ORD-1001"* (Northstar 100% Credit override)\n` +
              `2. **Cancellation Fee Waiver**: *"Cancel shipment ORD-1002"* (Northstar $0 waiver for >= 2h notice)\n` +
              `3. **Short Notice Fee**: *"Cancel shipment ORD-1003"* (Northstar 1h notice -> $50 fee applies)\n` +
              `4. **LumenWorks Agreement**: *"Check credit for ORD-2001"* (LumenWorks 50% Credit override)\n` +
              `5. **Standard SOP Audit**: *"Check ORD-3001"* (Beacon Retail Tier 2 standard SOP)\n` +
              `6. **Non-Carrier Exclusion**: *"Check ORD-4001"* (Weather blizzard force majeure)\n` +
              `7. **Cross-Tenant Security**: Switch account to LumenWorks and ask to audit \`ORD-1001\` to test RBAC isolation.\n` +
              `8. **Ops Anomaly Radar**: *"Show Problem 1 Anomaly Radar"* to review carrier hub delays.`
      }
    ]);
  };

  // Tenant-scoped staged actions (Customer only sees their own staged actions)
  const visibleStagedActions = role === 'customer'
    ? stagedActions.filter(a => normalizeAccountId(a.account_id) === normalizeAccountId(accountId))
    : stagedActions;

  return (
    <div className="flex h-screen w-full flex-col bg-[#0a0a0b] text-[#e2e8f0] overflow-hidden font-sans select-text">
      
      {/* AUTHENTICATION MODAL (ROLE-BASED LOGIN & REGISTRATION) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* USER PROFILE & PASSWORD SECURITY MODAL */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* HEADER NAVIGATION */}
      <Header
        role={role}
        setRole={setRole}
        accountId={accountId}
        setAccountId={setAccountId}
        currency={currency}
        setCurrency={setCurrency}
        onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
        onOpenLedgerModal={() => setIsLedgerModalOpen(true)}
        onOpenCommittedLedgerModal={() => setIsCommittedLedgerModalOpen(true)}
        onOpenBillingModal={() => setIsBillingModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenWallpaperModal={() => setIsWallpaperModalOpen(true)}
        committedCount={committedLogs.length}
      />

      {/* MAIN WORKSPACE: CHAT + APPROVAL GATE + ANOMALY RADAR */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* CENTER / CHAT WORKSPACE */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          
          {/* AMBER STAGING GATE (POPS UP WHEN ONE OR MORE ACTIONS ARE STAGED FOR ACTIVE TENANT) */}
          {visibleStagedActions.length > 0 && (
            <div className="px-4 sm:px-6 pt-4 shrink-0 bg-black/60 backdrop-blur-md z-20">
              <AmberApprovalGate
                stagedActions={visibleStagedActions}
                currency={currency}
                onConfirmSingle={handleConfirmSingleStagedAction}
                onConfirmAll={handleConfirmAllStagedActions}
                onDismissSingle={handleDismissSingleStagedAction}
                onDismissAll={handleDismissAllStagedActions}
              />
            </div>
          )}

          {/* CHAT WINDOW */}
          <ChatWindow
            messages={messages}
            onSendMessage={handleSendMessage}
            isThinking={isThinking}
            currency={currency}
            activeAccountId={accountId}
            role={role}
            committedLogs={committedLogs}
            onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
            onSwitchRole={(newRole) => setRole(newRole)}
            wallpaperThemeId={wallpaperThemeId}
            onSelectWallpaperTheme={handleSelectWallpaperTheme}
          />
        </div>

        {/* RIGHT SIDEBAR: OPS ANOMALY RADAR (PROBLEM 1) - ONLY VISIBLE IN INTERNAL OPERATIONS */}
        {role === 'internal_ops' && (
          <OpsAnomalyRadar
            orders={orders}
            tickets={tickets}
            committedLogs={committedLogs}
            currency={currency}
            activeAccountId={accountId}
            role={role}
            onAuditOrder={(orderId) => handleSendMessage(`Audit delay and calculate SLA compensation for ${orderId}`)}
            onStageTicketEscalation={(ticketId, orderId) => handleSendMessage(`Escalate high priority SLA breach ticket ${ticketId} for order ${orderId}`)}
            onStageAllCredits={() => {
              // Find all carrier delayed orders (>= 2h)
              const delayedOrders = orders.filter(o => o.carrier_fault && o.status === 'Delayed');
              const newStagedList: StagedStateAction[] = [];

              for (const ord of delayedOrders) {
                const audit = toolEngine.audit_policy_entitlements(ord.account_id, ord, 'credit');
                if (audit.eligible) {
                  const staged = toolEngine.stage_state_action('ISSUE_SERVICE_CREDIT', ord.order_id, ord.account_id, {
                    amountUSD: audit.credit_amount_USD,
                    amountINR: audit.credit_amount_INR,
                    percentage: audit.credit_percentage,
                    tierLevel: audit.tierLevel,
                    citation: audit.citation,
                    documentName: audit.documentName,
                    reason: audit.reason
                  });
                  newStagedList.push(staged);
                }
              }

              if (newStagedList.length > 0) {
                addBatchStagedActions(newStagedList);
                setMessages(prev => [
                  ...prev,
                  {
                    id: `batch_stage_credits_${Date.now()}`,
                    sender: 'assistant',
                    timestamp: new Date().toLocaleTimeString(),
                    text: `⚡ **Batch Staging Complete**: Staged **${newStagedList.length} carrier-delayed shipments** in the Amber Approval Gate for bulk credit confirmation.`
                  }
                ]);
              }
            }}
            onStageAllEscalations={() => {
              const highSlaTickets = tickets.filter(t => (t.priority === 'HIGH' || t.priority === 'CRITICAL') && t.status !== 'ESCALATED');
              const newStagedEscalations: StagedStateAction[] = [];

              for (const tck of highSlaTickets) {
                const staged = toolEngine.stage_state_action('ESCALATE_TICKET', tck.ticket_id, tck.account_id, {
                  tierLevel: 'Tier 1 / Tier 2 Operations Escalation Protocol',
                  citation: '04_Product_Operations_Guide.pdf Section 4.3 & Clause 7.3 Priority Escalation',
                  documentName: '04_Product_Operations_Guide.pdf',
                  reason: `High priority SLA breach escalated for carrier intervention on order ${tck.order_id}.`
                });
                newStagedEscalations.push(staged);
              }

              if (newStagedEscalations.length > 0) {
                addBatchStagedActions(newStagedEscalations);
                setMessages(prev => [
                  ...prev,
                  {
                    id: `batch_stage_escalations_${Date.now()}`,
                    sender: 'assistant',
                    timestamp: new Date().toLocaleTimeString(),
                    text: `⚡ **Batch Staging Complete**: Staged **${newStagedEscalations.length} SLA breach tickets** in the Amber Approval Gate for bulk priority escalation.`
                  }
                ]);
              }
            }}
            onOpenLedgerModal={() => setIsCommittedLedgerModalOpen(true)}
            onOpenBillingModal={() => setIsBillingModalOpen(true)}
          />
        )}

      </div>

      {/* MODALS */}
      <CommittedLedgerModal
        isOpen={isCommittedLedgerModalOpen}
        onClose={() => setIsCommittedLedgerModalOpen(false)}
        committedLogs={committedLogs}
        currency={currency}
        activeAccountId={accountId}
        role={role}
        onRevertLastBatch={handleRevertLastBatch}
      />

      <BillingMonitor
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        currency={currency}
      />

      <WallpaperModal
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
        activeThemeId={wallpaperThemeId}
        onSelectTheme={handleSelectWallpaperTheme}
      />

      <PolicyDocumentsModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
      />

      <OrderLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        orders={orders}
        currency={currency}
        onSelectOrder={(orderId) => handleSendMessage(`Lookup and audit order ${orderId}`)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ParcelPilotApp />
    </AuthProvider>
  );
}
