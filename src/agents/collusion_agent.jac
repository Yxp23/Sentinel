"""
Physician Collusion Agent — Step 4b.

Detects potential fraud rings by finding physicians who appear on claims
from multiple providers. When a physician is shared between 2+ providers
with anomalous billing, it flags a potential collusion ring.

Run:
  jac run src/agents/collusion_agent.jac
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
# Output types
# ---------------------------------------------------------------------------

obj CollusionRing {
    has physician_id: str,
        connected_providers: list[str],
        fraud_providers_in_ring: list[str],
        shared_claim_count: int,
        total_ring_amount: float,
        risk_level: str,
        reasoning: str;
}

# ---------------------------------------------------------------------------
# byLLM function — assess a potential collusion ring
# ---------------------------------------------------------------------------

def assess_collusion(
    physician_id: str,
    connected_providers: list[str],
    fraud_providers_in_ring: list[str],
    non_fraud_providers_in_ring: list[str],
    shared_claim_count: int,
    total_ring_amount: float,
    provider_details: list[dict]
) -> CollusionRing by llm(incl_info={
    "task": "You are a healthcare fraud investigator analyzing potential provider collusion rings. A physician appears on claims from multiple providers. Examine the pattern and determine if this looks like a coordinated fraud ring. Consider: how many providers share this physician, what fraction are fraud-labeled, what is the total money flowing through this physician, and whether the pattern suggests kickbacks or coordinated billing.",
    "risk_calibration": "HIGH: 3+ providers share this physician AND the majority (>50%) are fraud-labeled AND total_ring_amount > $50,000. MEDIUM: 2+ fraud-labeled providers share physician, OR total_ring_amount > $20,000 with at least one fraud provider. LOW: physician shared between providers but mostly non-fraud-labeled or very low dollar amounts — could be a legitimate group practice.",
    "note": "fraud_providers_in_ring and non_fraud_providers_in_ring are ground-truth labels. A ring with all non-fraud providers is unlikely to be collusion — be appropriately skeptical. Cite the specific dollar amounts and provider counts in your reasoning."
});

# ---------------------------------------------------------------------------
# Walker — two-phase: collect physician-provider mapping, then analyze
# ---------------------------------------------------------------------------

walker CollusionAgent {
    has phys_to_providers: dict = {},
        phys_claim_counts: dict = {},
        phys_amounts: dict = {},
        provider_info: dict = {},
        findings: list[CollusionRing] = [];

    can on_root with Root entry {
        # Phase 1: Walk all providers and their claims to build
        # a mapping of physician_id -> list of provider_ids
        for prov in [-->] {
            self.provider_info[prov.id] = {
                "id": prov.id,
                "fraud_label": prov.fraud_label,
                "total_claims": prov.total_claims,
                "total_amount": prov.total_amount
            };

            for claim in [prov -->] {
                for phys in [claim -->] {
                    # Build physician -> providers mapping
                    if phys.id not in self.phys_to_providers {
                        self.phys_to_providers[phys.id] = [];
                        self.phys_claim_counts[phys.id] = 0;
                        self.phys_amounts[phys.id] = 0.0;
                    }
                    if prov.id not in self.phys_to_providers[phys.id] {
                        self.phys_to_providers[phys.id].append(prov.id);
                    }
                    self.phys_claim_counts[phys.id] += 1;
                    self.phys_amounts[phys.id] += claim.amount;
                }
            }
        }

        # Phase 2: Find physicians shared between 2+ providers
        print(f"[collusion] Mapped {len(self.phys_to_providers)} physicians to providers");

        shared_physicians = [];
        for phys_id in self.phys_to_providers {
            providers_list = self.phys_to_providers[phys_id];
            if len(providers_list) >= 2 {
                shared_physicians.append(phys_id);
            }
        }

        print(f"[collusion] Found {len(shared_physicians)} physicians shared between 2+ providers\n");

        # Phase 3: Assess each shared physician for collusion
        for phys_id in shared_physicians {
            providers_list = self.phys_to_providers[phys_id];
            claim_count = self.phys_claim_counts[phys_id];
            total_amount = self.phys_amounts[phys_id];

            fraud_provs = [];
            non_fraud_provs = [];
            details = [];
            for pid in providers_list {
                info = self.provider_info[pid];
                details.append(info);
                if info["fraud_label"] == "Yes" {
                    fraud_provs.append(pid);
                } else {
                    non_fraud_provs.append(pid);
                }
            }

            # Only call LLM if at least one fraud provider is in the ring
            if len(fraud_provs) > 0 {
                print(f"[collusion] Assessing physician {phys_id} "
                      f"(shared by {len(providers_list)} providers, "
                      f"{len(fraud_provs)} fraud, "
                      f"${total_amount:,.0f} total)...");

                ::py::
                import time as _t; _t.sleep(2)
                ::py::

                ring = assess_collusion(
                    physician_id=phys_id,
                    connected_providers=providers_list,
                    fraud_providers_in_ring=fraud_provs,
                    non_fraud_providers_in_ring=non_fraud_provs,
                    shared_claim_count=claim_count,
                    total_ring_amount=total_amount,
                    provider_details=details
                );

                # Post-LLM corrections
                fraud_fraction = len(fraud_provs) / len(providers_list);
                if ring.risk_level == "HIGH" and (fraud_fraction < 0.5 or total_amount < 50000.0) {
                    ring.risk_level = "MEDIUM";
                } elif ring.risk_level == "MEDIUM" and fraud_fraction == 0.0 {
                    ring.risk_level = "LOW";
                }

                self.findings.append(ring);

                print(f"  → risk={ring.risk_level}, "
                      f"reasoning={ring.reasoning[:150]}...\n");
            }
        }
    }
}

# ---------------------------------------------------------------------------
# Entry point — same graph build as billing agent
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

    print("[collusion] Graph ready. Running Physician Collusion Agent...\n");

    agent = root spawn CollusionAgent();

    print(f"\n[collusion] ── Results ─────────────────────────────────");
    high_risk = [];
    for f in agent.findings {
        if f.risk_level.upper() in ["HIGH", "CONFIRMED"] {
            high_risk.append(f);
        }
    }
    print(f"  Total rings analyzed     : {len(agent.findings)}");
    print(f"  HIGH risk rings          : {len(high_risk)}");

    if high_risk {
        print(f"\n  HIGH RISK collusion rings:");
        for f in high_risk {
            print(f"    Physician: {f.physician_id}");
            print(f"      Providers in ring : {f.connected_providers}");
            print(f"      Fraud providers   : {f.fraud_providers_in_ring}");
            print(f"      Claims through MD : {f.shared_claim_count}");
            print(f"      Total amount      : ${f.total_ring_amount:,.0f}");
            print(f"      Reasoning         : {f.reasoning[:200]}...");
        }
    }
    print("[collusion] ────────────────────────────────────────────");
}