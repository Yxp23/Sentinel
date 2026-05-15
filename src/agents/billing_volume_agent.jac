"""
Billing Volume Agent — Step 4.

Detects providers with anomalous billing patterns: unusually high claim counts,
reimbursement amounts, length-of-stay, or inpatient/outpatient ratio relative
to the peer group.

Produces a structured FraudAssessment per provider, including risk level,
observed anomalies, and a reasoning chain the LLM can explain.

Run:
  jac run src/agents/billing_volume_agent.jac
"""

::py::
import sys, os as _os
_proj_root = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..'))
if _proj_root not in sys.path:
    sys.path.insert(0, _proj_root)
sys.setrecursionlimit(10000)
::py::

include src.graph.schema;

import from src.loader.load_data { load_subset }

# ---------------------------------------------------------------------------
# Output type — structured finding per provider
# ---------------------------------------------------------------------------

obj FraudAssessment {
    has provider_id: str,
        risk_level: str,          # "LOW" | "MEDIUM" | "HIGH"
        anomalies: list[str],     # observed red flags
        reasoning: str;           # LLM explanation chain
}

# ---------------------------------------------------------------------------
# byLLM function — assess one provider from numeric context
# ---------------------------------------------------------------------------

def assess_billing(
    provider_id: str,
    total_claims: int,
    total_amount: float,
    inpatient_count: int,
    outpatient_count: int,
    avg_claim_amount: float,
    peer_avg_claims: float,
    peer_avg_amount: float,
    top_diagnosis_codes: list[str],
    fraud_label: str,
) -> FraudAssessment by llm();

# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------

walker BillingVolumeAgent {
    has findings: list[FraudAssessment] = [],
        # peer group stats — populated on root entry
        peer_avg_claims: float = 0.0,
        peer_avg_amount: float = 0.0,
        _prov_count: int = 0,
        _total_claims_sum: int = 0,
        _total_amount_sum: float = 0.0;

    can on_root with Root entry {
        # First pass: collect peer averages by counting providers
        for prov in [-->] {
            self._prov_count += 1;
            self._total_claims_sum += prov.total_claims;
            self._total_amount_sum += prov.total_amount;
        }
        if self._prov_count > 0 {
            self.peer_avg_claims = self._total_claims_sum / self._prov_count;
            self.peer_avg_amount = self._total_amount_sum / self._prov_count;
        }
        print(f"[billing] Peer group: {self._prov_count} providers, "
              f"avg_claims={self.peer_avg_claims:.0f}, "
              f"avg_amount=${self.peer_avg_amount:,.0f}");
        visit [-->];
    }

    can on_provider with Provider entry {
        # Collect diagnosis codes from sampled Claims on this provider
        diag_counts: dict = {};
        for claim in [-->] {
            for code in claim.diagnosis_codes {
                diag_counts[code] = diag_counts.get(code, 0) + 1;
            }
        }
        # Top 5 diagnosis codes by frequency
        sorted_codes = sorted(diag_counts.keys(),
                              key=lambda k: diag_counts[k],
                              reverse=True);
        top_diag = sorted_codes[:5];

        avg_amt = 0.0;
        if here.total_claims > 0 {
            avg_amt = here.total_amount / here.total_claims;
        }

        # Only assess providers that look anomalous relative to peer group
        threshold_claims = self.peer_avg_claims * 1.5;
        threshold_amount = self.peer_avg_amount * 1.5;
        if here.total_claims <= threshold_claims and here.total_amount <= threshold_amount {
            print(f"[billing] {here.id} skipped - within normal range "
                  f"(claims={here.total_claims}, amount=${here.total_amount:,.0f})");
        } else {
            print(f"[billing] Assessing {here.id} "
                  f"(claims={here.total_claims}, amount=${here.total_amount:,.0f}, "
                  f"label={here.fraud_label})...");

            ::py::
            import time as _t; _t.sleep(5)
            ::py::

            assessment = assess_billing(
                provider_id       = here.id,
                total_claims      = here.total_claims,
                total_amount      = here.total_amount,
                inpatient_count   = here.inpatient_count,
                outpatient_count  = here.outpatient_count,
                avg_claim_amount  = avg_amt,
                peer_avg_claims   = self.peer_avg_claims,
                peer_avg_amount   = self.peer_avg_amount,
                top_diagnosis_codes = top_diag,
                fraud_label       = here.fraud_label,
            );

            self.findings.append(assessment);
            report assessment;
        }
    }
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

with entry {
    data = load_subset(provider_limit=30, non_fraud_sample=15);

    providers = data["providers"];
    patients  = data["patients"];
    claims    = data["claims"];

    prov_index: dict = {};
    pat_index:  dict = {};
    phys_index: dict = {};

    for p in providers {
        fl = "Yes";
        if not p["fraud_label"] { fl = "No"; }
        tc = p.get("total_claims", 0) or 0;
        ta = p.get("total_amount", 0.0) or 0.0;
        ic = p.get("inpatient_count", 0) or 0;
        oc = p.get("outpatient_count", 0) or 0;
        prov_node = Provider(
            id=p["id"], fraud_label=fl,
            total_claims=tc, total_amount=ta,
            inpatient_count=ic, outpatient_count=oc
        );
        root ++> prov_node;
        prov_index[p["id"]] = prov_node;
    }

    for p in patients {
        g = p["gender"];
        gender_int = 0;
        if g == "M" { gender_int = 1; } elif g == "F" { gender_int = 2; }
        state_int = 0;
        if p["state"] is not None { state_int = p["state"]; }
        age_int = 0;
        if p["age"] is not None { age_int = p["age"]; }
        ip_amt = 0.0;
        if p["ip_annual_reimbursed"] is not None { ip_amt = p["ip_annual_reimbursed"]; }
        op_amt = 0.0;
        if p["op_annual_reimbursed"] is not None { op_amt = p["op_annual_reimbursed"]; }
        pat_node = Patient(
            id=p["id"], gender=gender_int, state=state_int, age=age_int,
            chronic_conditions=p["chronic_conditions"], deceased=p["deceased"],
            ip_annual_reimbursed=ip_amt, op_annual_reimbursed=op_amt
        );
        pat_index[p["id"]] = pat_node;
    }

    for c in claims {
        pid = c["provider_id"];
        prov_node = prov_index.get(pid);
        if not prov_node { continue; }
        amt = 0.0;
        if c["amount"] is not None { amt = c["amount"]; }
        start = "";
        if c["claim_start"] is not None { start = c["claim_start"]; }
        end_dt = "";
        if c["claim_end"] is not None { end_dt = c["claim_end"]; }
        los = 0;
        if c["los_days"] is not None { los = c["los_days"]; }
        claim_node = Claim(
            id=c["id"], amount=amt, claim_type=c["type"],
            claim_start=start, claim_end=end_dt, los_days=los,
            diagnosis_codes=c["diagnosis_codes"],
            procedure_codes=c["procedure_codes"],
            provider_id=pid, bene_id=c["bene_id"]
        );
        prov_node ++> claim_node;
        bene_id = c["bene_id"];
        pat_node = pat_index.get(bene_id);
        if pat_node { pat_node ++> claim_node; }
        phys_id = c["attending_physician"];
        if phys_id {
            if phys_id not in phys_index {
                phys_index[phys_id] = Physician(id=phys_id);
            }
            claim_node ++> phys_index[phys_id];
        }
    }

    print("[billing] Graph ready. Running Billing Volume Agent...\n");

    agent = root spawn BillingVolumeAgent();

    print(f"\n[billing] ── Results ─────────────────────────────────");
    high_risk = [];
    for f in agent.findings {
        if f.risk_level == "HIGH" {
            high_risk.append(f);
        }
    }
    print(f"  Total providers assessed : {len(agent.findings)}");
    print(f"  HIGH risk findings       : {len(high_risk)}");

    if high_risk {
        print(f"\n  HIGH RISK providers:");
        for f in high_risk {
            print(f"    {f.provider_id}");
            print(f"      Anomalies : {f.anomalies}");
            print(f"      Reasoning : {f.reasoning[:200]}...");
        }
    }
    print("[billing] ────────────────────────────────────────────");
}
