"""
Patient Pattern Agent — Step 4c.

Detects suspicious patient-level patterns:
  1. Multi-provider shopping — patient billed by 3+ different providers
  2. High claim volume — patient has 10+ sampled claims
  3. Post-death billing — deceased patient has claims dated after DOD

Traverses root → Provider → Claim paths to build per-patient stats, then
calls the LLM only on patients that trip at least one anomaly threshold.

Run:
  jac run src/agents/patient_agent.jac
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
# Output type
# ---------------------------------------------------------------------------

obj PatientFinding {
    has patient_id: str,
        risk_level: str,         # "LOW" | "MEDIUM" | "HIGH"
        flags: list[str],        # e.g. ["multi_provider", "post_death_claim"]
        reasoning: str;
}

# ---------------------------------------------------------------------------
# byLLM function
# ---------------------------------------------------------------------------

def assess_patient(
    patient_id: str,
    provider_count: int,
    unique_providers: list[str],
    claim_count: int,
    total_amount: float,
    deceased: bool,
    has_post_death_claim: bool,
    dod: str,
    latest_claim_date: str,
    provider_fraud_labels: list[str],
) -> PatientFinding by llm(incl_info={
    "task": "You are a healthcare fraud investigator analyzing patient billing patterns. A patient has been flagged for anomalous activity. Examine the pattern and assess the risk. Consider: how many different providers billed for this patient (doctor shopping or identity theft), total claim volume, whether any claims appear after death (deceased flag fraud), and whether the billing providers are themselves flagged as fraudulent.",
    "output_format": "Return a PatientFinding with risk_level ('LOW'/'MEDIUM'/'HIGH'), a flags list (choose from: 'multi_provider', 'high_volume', 'post_death_claim', 'fraud_provider_overlap'), and a reasoning string explaining your assessment step by step."
});

# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------

walker PatientPatternAgent {
    has deceased_lookup: dict = {},    # bene_id -> {deceased: bool, dod: str}
        provider_fraud: dict = {},     # provider_id -> fraud_label str
        findings: list[PatientFinding] = [];

    can on_root with Root entry {
        # Phase 1: walk root → Provider → Claim, building per-patient stats
        # Using flat dicts to mirror collusion_agent pattern
        pat_providers: dict = {};    # bene_id -> list[str]
        pat_claim_counts: dict = {}; # bene_id -> int
        pat_amounts: dict = {};      # bene_id -> float
        pat_dates: dict = {};        # bene_id -> list[str]

        for prov in [-->] {
            self.provider_fraud[prov.id] = prov.fraud_label;

            for claim in [prov -->] {
                bene = claim.bene_id;

                if bene not in pat_providers {
                    pat_providers[bene] = [];
                    pat_claim_counts[bene] = 0;
                    pat_amounts[bene] = 0.0;
                    pat_dates[bene] = [];
                }

                if prov.id not in pat_providers[bene] {
                    pat_providers[bene].append(prov.id);
                }
                pat_claim_counts[bene] += 1;
                pat_amounts[bene] += claim.amount;
                if claim.claim_start {
                    pat_dates[bene].append(claim.claim_start);
                }
            }
        }

        print(f"[patient] Collected stats for {len(pat_providers)} patients\n");

        # Phase 2: flag anomalous patients and call LLM
        assessed = 0;
        skipped = 0;

        for bene in pat_providers {
            provider_list = pat_providers[bene];
            claim_cnt     = pat_claim_counts[bene];
            total_amt     = pat_amounts[bene];
            dates         = pat_dates[bene];

            # Deceased / post-death check
            deceased    = False;
            dod_str     = "";
            post_death  = False;
            pat_info    = self.deceased_lookup.get(bene, {});
            if pat_info {
                deceased = pat_info.get("deceased", False);
                dod_str  = pat_info.get("dod", "") or "";
                if deceased and dod_str and dates {
                    latest = max(dates);
                    if latest > dod_str {
                        post_death = True;
                    }
                }
            }

            prov_count = len(provider_list);

            # Filter: only assess patients with at least one anomaly
            if prov_count < 3 and claim_cnt < 10 and not post_death {
                skipped += 1;
                continue;
            }

            # Collect fraud labels for the providers that billed this patient
            fraud_labels = [];
            for pid in provider_list {
                fraud_labels.append(self.provider_fraud.get(pid, "Unknown"));
            }

            latest_date = "";
            if dates {
                latest_date = max(dates);
            }

            print(f"[patient] Assessing {bene} "
                  f"(providers={prov_count}, claims={claim_cnt}, "
                  f"amount=${total_amt:,.0f}, deceased={deceased}, "
                  f"post_death={post_death})...");

            ::py::
            import time as _t; _t.sleep(2)
            ::py::

            finding = assess_patient(
                patient_id           = bene,
                provider_count       = prov_count,
                unique_providers     = provider_list,
                claim_count          = claim_cnt,
                total_amount         = total_amt,
                deceased             = deceased,
                has_post_death_claim = post_death,
                dod                  = dod_str,
                latest_claim_date    = latest_date,
                provider_fraud_labels = fraud_labels,
            );

            self.findings.append(finding);
            assessed += 1;

            print(f"  → risk={finding.risk_level}, flags={finding.flags}\n");
        }

        print(f"[patient] Assessed: {assessed}, skipped: {skipped}");
    }
}

# ---------------------------------------------------------------------------
# Entry point — same graph build as billing / collusion agents
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

    # Build deceased lookup from Python patient data so the walker can check DOD
    deceased_map: dict = {};
    for p in patients {
        dod_val = p.get("dod", None) or "";
        deceased_map[p["id"]] = {
            "deceased": p["deceased"],
            "dod": dod_val
        };
    }

    print("[patient] Graph ready. Running Patient Pattern Agent...\n");

    agent = root spawn PatientPatternAgent(
        deceased_lookup=deceased_map
    );

    print(f"\n[patient] ── Results ──────────────────────────────────");
    high_risk = [];
    for f in agent.findings {
        if f.risk_level == "HIGH" {
            high_risk.append(f);
        }
    }
    print(f"  Total patients assessed : {len(agent.findings)}");
    print(f"  HIGH risk findings      : {len(high_risk)}");

    if high_risk {
        print(f"\n  HIGH RISK patients:");
        for f in high_risk {
            print(f"    {f.patient_id}");
            print(f"      Flags     : {f.flags}");
            print(f"      Reasoning : {f.reasoning[:200]}...");
        }
    }
    print("[patient] ────────────────────────────────────────────");
}
