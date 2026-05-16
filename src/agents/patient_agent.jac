"""
Patient Pattern Agent — Step 4c.

Detects suspicious patient-level patterns:
  1. multi_provider     — patient billed by 3+ different providers
  2. high_volume        — patient has 10+ sampled claims
  3. post_death_claim   — deceased patient has claims dated after DOD
  4. fraud_provider_overlap — 2+ of the billing providers are fraud-labeled

Flags are computed from hard data (not left to the LLM). The LLM only
provides risk_level and reasoning given the pre-computed flags.
Post-LLM corrections enforce consistency (e.g. post-death is always HIGH,
low-amount high-volume is capped at MEDIUM).

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
# Output types
# ---------------------------------------------------------------------------

obj PatientFinding {
    has patient_id: str,
        risk_level: str,         # "LOW" | "MEDIUM" | "HIGH"
        flags: list[str],        # computed from data, not LLM
        reasoning: str;
}

# LLM only returns risk_level + reasoning — flags come from code
obj PatientAssessment {
    has risk_level: str,
        reasoning: str;
}

# ---------------------------------------------------------------------------
# byLLM function — risk + reasoning only, flags already computed
# ---------------------------------------------------------------------------

def assess_patient(
    patient_id: str,
    provider_count: int,
    unique_providers: list[str],
    claim_count: int,
    total_amount: float,
    avg_claim_amount: float,
    deceased: bool,
    has_post_death_claim: bool,
    dod: str,
    latest_claim_date: str,
    provider_fraud_labels: list[str],
    fraud_provider_count: int,
    observed_flags: list[str],
) -> PatientAssessment by llm(incl_info={
    "task": "You are a healthcare fraud investigator. A patient has been flagged with one or more anomaly flags computed from billing data. Your job is to assess the risk level and explain your reasoning clearly, citing specific numbers.",
    "risk_calibration": "HIGH: any post-death claim (automatic), OR 3+ fraud-labeled providers billing same patient with total_amount > $10,000, OR patient appears at 4+ different providers. MEDIUM: 2–3 fraud-labeled providers with total_amount $2,000–$10,000, OR high claim volume (10+) with fraud provider overlap, OR 3+ providers with mixed fraud labels. LOW: fraud_provider_overlap with only 2 providers and total_amount < $2,000 (high false-positive rate when 50% of providers carry fraud labels), OR borderline volume with low dollar amounts.",
    "note": "observed_flags are facts derived from data — do not contradict them. Focus your reasoning on explaining the severity and what the pattern suggests in the context of Medicare fraud."
});

# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------

walker PatientPatternAgent {
    has deceased_lookup: dict = {},
        provider_fraud: dict = {},
        findings: list[PatientFinding] = [];

    can on_root with Root entry {
        # Phase 1: walk root → Provider → Claim, building per-patient stats
        pat_providers: dict = {};
        pat_claim_counts: dict = {};
        pat_amounts: dict = {};
        pat_dates: dict = {};

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

        # Phase 2: flag and assess anomalous patients
        assessed = 0;
        skipped = 0;

        for bene in pat_providers {
            provider_list  = pat_providers[bene];
            claim_cnt      = pat_claim_counts[bene];
            total_amt      = pat_amounts[bene];
            dates          = pat_dates[bene];
            prov_count     = len(provider_list);

            # Fraud provider count
            fraud_prov_count = 0;
            fraud_labels = [];
            for pid in provider_list {
                lbl = self.provider_fraud.get(pid, "No");
                fraud_labels.append(lbl);
                if lbl == "Yes" {
                    fraud_prov_count += 1;
                }
            }

            # Deceased / post-death check
            deceased   = False;
            dod_str    = "";
            post_death = False;
            pat_info   = self.deceased_lookup.get(bene, {});
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

            # ── Compute flags from hard data ──────────────────────────────
            computed_flags: list[str] = [];
            if prov_count >= 3 {
                computed_flags.append("multi_provider");
            }
            if claim_cnt >= 10 {
                computed_flags.append("high_volume");
            }
            if post_death {
                computed_flags.append("post_death_claim");
            }
            if fraud_prov_count >= 2 {
                computed_flags.append("fraud_provider_overlap");
            }

            # Skip patients with no flags at all
            if not computed_flags {
                skipped += 1;
                continue;
            }

            avg_claim_amt = 0.0;
            if claim_cnt > 0 {
                avg_claim_amt = total_amt / claim_cnt;
            }

            latest_date = "";
            if dates {
                latest_date = max(dates);
            }

            print(f"[patient] Assessing {bene} "
                  f"(providers={prov_count}, claims={claim_cnt}, "
                  f"amount=${total_amt:,.0f}, flags={computed_flags})...");

            ::py::
            import time as _t; _t.sleep(2)
            ::py::

            llm_out = assess_patient(
                patient_id           = bene,
                provider_count       = prov_count,
                unique_providers     = provider_list,
                claim_count          = claim_cnt,
                total_amount         = total_amt,
                avg_claim_amount     = avg_claim_amt,
                deceased             = deceased,
                has_post_death_claim = post_death,
                dod                  = dod_str,
                latest_claim_date    = latest_date,
                provider_fraud_labels = fraud_labels,
                fraud_provider_count = fraud_prov_count,
                observed_flags       = computed_flags,
            );

            # ── Post-LLM risk correction ──────────────────────────────────
            final_risk = llm_out.risk_level;
            if post_death {
                # Post-death billing is always HIGH regardless of amount
                final_risk = "HIGH";
            } elif final_risk == "HIGH" and total_amt < 2000.0 {
                # Low dollar amounts (< $2K) don't justify HIGH — could be coincidence
                # especially in a dataset where 50% of providers are fraud-labeled
                final_risk = "MEDIUM";
            } elif final_risk == "HIGH" and prov_count == 2 and fraud_prov_count == 2 and total_amt < 10000.0 {
                # Exactly 2 fraud providers with moderate amounts: needs more evidence for HIGH
                final_risk = "MEDIUM";
            }

            finding = PatientFinding(
                patient_id = bene,
                risk_level = final_risk,
                flags      = computed_flags,
                reasoning  = llm_out.reasoning,
            );

            self.findings.append(finding);
            assessed += 1;
            report finding;

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

    # Build deceased lookup so the walker can check DOD without backward traversal
    deceased_map: dict = {};
    for p in patients {
        dod_val = p.get("dod", None) or "";
        deceased_map[p["id"]] = {
            "deceased": p["deceased"],
            "dod": dod_val
        };
    }

    print("[patient] Graph ready. Running Patient Pattern Agent...\n");

    agent = root spawn PatientPatternAgent(deceased_lookup=deceased_map);

    print(f"\n[patient] ── Results ──────────────────────────────────");
    high_risk  = [];
    med_risk   = [];
    for f in agent.findings {
        if f.risk_level == "HIGH"   { high_risk.append(f); }
        elif f.risk_level == "MEDIUM" { med_risk.append(f); }
    }
    print(f"  Total patients assessed : {len(agent.findings)}");
    print(f"  HIGH risk               : {len(high_risk)}");
    print(f"  MEDIUM risk             : {len(med_risk)}");

    for f in agent.findings {
        print(f"\n  [{f.risk_level}] {f.patient_id}");
        print(f"    Flags     : {f.flags}");
        print(f"    Reasoning : {f.reasoning[:250]}...");
    }
    print("\n[patient] ────────────────────────────────────────────");
}
