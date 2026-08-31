# AegisOps CI/CD Pipeline Security & Static Analysis Specification
**Autonomous B2B Logistics Support & Operations Engine — Security Gates, Secret Scanning & Firestore Rules Auditing**

---

## 1. Executive Security Framework & Gate Topology

**AegisOps** processes sensitive enterprise logistics contracts, freight billing allocations, and live carrier telemetry. To guarantee zero leakage of proprietary Master Service Agreements (MSAs), tenant API keys, and unauthorized database access, the CI/CD pipeline enforces automated security quality gates prior to staging and production deployments.

```
[Developer Push / PR]
          │
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         STAGE 1: SECRET SCANNING                         │
│  - Gitleaks Static Analysis across git history and workspace             │
│  - Specific Rules for `firebase-applet-config.json` & `.env` files       │
│  - Entropy and regex pattern matching for GCP/Firebase API keys          │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ PASS
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   STAGE 2: FIRESTORE SECURITY RULES AUDIT                │
│  - Static AST Linter against `firestore.rules`                           │
│  - Detection of overly permissive rules (`allow read, write: if true;`)  │
│  - Enforcement of Tenant RBAC & Auth claims on `ledger_entries`          │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ PASS
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 STAGE 3: DEPENDENCY AUDIT & SAST GATES                   │
│  - NPM Audit (CVSS >= 7.0 High/Critical blocking)                        │
│  - TypeScript strict type safety & zero untyped `any` injection checks   │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ PASS
                                      ▼
[Artifact Build & Container Deployment to Google Cloud Run]
```

---

## 2. Secret Scanning & Leak Prevention (`Gitleaks`)

### 2.1 Gitleaks Configuration (`.gitleaks.toml`)
The CI/CD pipeline runs `gitleaks detect` on all pull requests and commits:

```toml
# .gitleaks.toml
title = "AegisOps Gitleaks Security Profile"

[extend]
useDefault = true

[[rules]]
id = "firebase-service-account-private-key"
description = "Detected Firebase Service Account Private Key"
regex = '''(?i)-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----'''
keywords = ["private_key", "BEGIN PRIVATE KEY"]
severity = "CRITICAL"
```

---

## 3. Firestore Security Rules Audit (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ledger_entries/{entryId} {
      allow read: if request.auth != null && (
        request.auth.token.role == 'internal_ops' ||
        resource.data.account_id == request.auth.token.accountId
      );
      allow write: if request.auth != null;
    }
  }
}
```

---

## 4. Multi-Tenant RBAC Boundary Verification
All tool handlers (`lookup_order_data`, `audit_policy_entitlements`, `stage_state_action`) check tenant context against the user session. Unscoped customer queries for foreign tenant records return a strict 403 Forbidden with zero data disclosure.
