"""
Synthesis Agent — Step 5.

Runs all three specialist agents on a single graph build and synthesizes
their findings into a unified CaseFile per flagged provider.

Run:
  jac run src/agents/synthesis_agent.jac
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
import from src.agents.billing_volume_agent { BillingVolumeAgent, FraudAssessment }
import from src.agents.collusion_agent { CollusionAgent, CollusionRing }
import from src.agents.patient_agent { PatientPatternAgent, PatientFinding }

# ---------------------------------------------------------------------------
# Output type
# ---------------------------------------------------------------------------

obj CaseFile {
    has provider_id: str,
        overall_risk_level: str,      # "LOW" | "MEDIUM" | "HIGH"
        billing_findings: list[str],  # anomaly strings from BillingVolumeAgent
        collusion_findings: list[str],# ring descriptions from CollusionAgent
        patient_findings: list[str],  # patient flag summaries from PatientPatternAgent
        combined_reasoning: str,      # LLM synthesis of all evidence
        recommended_action: str,      # e.g. "Refer for audit", "Flag for investigation"
        estimated_fraud_amount: float;
}

# ---------------------------------------------------------------------------
# byLLM function — synthesize one provider's cross-agent evidence
# ---------------------------------------------------------------------------

def synthesize_case(
    provider_id: str,
    fraud_label: str,
    total_claims: int,
    total_amount: float,
    billing_risk: str,
    billing_anomalies: list[str],
    billing_reasoning: str,
    collusion_ring_count: int,
    collusion_physicians: list[str],
    collusion_max_risk: str,
    collusion_total_amount: float,
    patient_flagged_count: int,
    patient_high_count: int,
    patient_flags_seen: list[str],
) -> CaseFile by llm(incl_info={
    "task": "You are a senior Medicare fraud investigator writing a unified case file. You have findings from three specialist agents: a billing volume analyst, a physician collusion detector, and a patient pattern analyst. Synthesize all evidence into a single coherent assessment.",
    "risk_calibration": "HIGH: billing_risk=HIGH with any corroborating collusion or patient evidence, OR collusion_max_risk=HIGH regardless of billing, OR patient_high_count >= 3 with billing_risk >= MEDIUM. MEDIUM: any single agent flagged MEDIUM or higher without strong corroboration from others. LOW: only one agent raised a flag and it is MEDIUM with no corroboration.",
    "recommended_actions": "Refer for full audit: billing HIGH + any corroboration. Flag for investigation: single-agent HIGH or multi-agent MEDIUM. Monitor: single-agent MEDIUM with low dollar amounts. No action: all agents LOW.",
    "note": "billing_risk, collusion_max_risk may be empty string if that agent found nothing for this provider. estimated_fraud_amount should be your best estimate of dollars at risk — use total_amount as an upper bound, scale down for partial fraud suspicion. fraud_label is ground truth — use it to calibrate but cite the evidence you actually observe."
});

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

    # deceased lookup for PatientPatternAgent
    deceased_map: dict = {};
    for p in patients {
        dod_val = p.get("dod", None) or "";
        deceased_map[p["id"]] = {
            "deceased": p["deceased"],
            "dod": dod_val
        };
    }

    # patient → provider mapping for cross-referencing patient findings to providers
    pat_to_provs: dict = {};
    for c in claims {
        bene = c["bene_id"];
        pid  = c["provider_id"];
        if bene not in pat_to_provs {
            pat_to_provs[bene] = [];
        }
        if pid not in pat_to_provs[bene] {
            pat_to_provs[bene].append(pid);
        }
    }

    print("[synthesis] Graph ready. Running all agents...\n");

    # ── Run all three agents ──────────────────────────────────────────────
    billing_agent   = root spawn BillingVolumeAgent();
    collusion_agent = root spawn CollusionAgent();
    patient_agent   = root spawn PatientPatternAgent(deceased_lookup=deceased_map);

    print(f"\n[synthesis] Agent results:");
    print(f"  Billing   : {len(billing_agent.findings)} provider findings");
    print(f"  Collusion : {len(collusion_agent.findings)} ring findings");
    print(f"  Patient   : {len(patient_agent.findings)} patient findings\n");

    # ── Index billing findings by provider_id ────────────────────────────
    provider_billing: dict = {};
    for f in billing_agent.findings {
        provider_billing[f.provider_id] = f;
    }

    # ── Index collusion rings by provider_id (one ring → multiple providers) ──
    provider_collusion: dict = {};
    for ring in collusion_agent.findings {
        for pid in ring.connected_providers {
            if pid not in provider_collusion {
                provider_collusion[pid] = [];
            }
            provider_collusion[pid].append(ring);
        }
    }

    # ── Index patient findings by provider_id via pat_to_provs ───────────
    provider_patients: dict = {};
    for pf in patient_agent.findings {
        prov_list = pat_to_provs.get(pf.patient_id, []);
        for pid in prov_list {
            if pid not in provider_patients {
                provider_patients[pid] = [];
            }
            provider_patients[pid].append(pf);
        }
    }

    # ── Collect all flagged providers ────────────────────────────────────
    all_flagged: list[str] = [];
    for pid in provider_billing {
        if pid not in all_flagged { all_flagged.append(pid); }
    }
    for pid in provider_collusion {
        if pid not in all_flagged { all_flagged.append(pid); }
    }
    for pid in provider_patients {
        if pid not in all_flagged { all_flagged.append(pid); }
    }

    print(f"[synthesis] {len(all_flagged)} providers appear in at least one agent's findings.");
    print(f"[synthesis] Synthesizing case files...\n");

    # ── Synthesize one CaseFile per flagged provider ─────────────────────
    case_files: list[CaseFile] = [];

    for pid in all_flagged {
        prov_node = prov_index.get(pid);
        if not prov_node { continue; }

        # Billing evidence
        b_risk      = "";
        b_anomalies: list[str] = [];
        b_reasoning = "";
        bf = provider_billing.get(pid);
        if bf {
            b_risk      = bf.risk_level;
            b_anomalies = bf.anomalies;
            b_reasoning = bf.reasoning;
        }

        # Collusion evidence
        rings = provider_collusion.get(pid, []);
        c_ring_count = len(rings);
        c_physicians: list[str] = [];
        c_max_risk   = "";
        c_total_amt  = 0.0;
        for ring in rings {
            c_total_amt += ring.total_ring_amount;
            if ring.physician_id not in c_physicians {
                c_physicians.append(ring.physician_id);
            }
            if c_max_risk == "" {
                c_max_risk = ring.risk_level;
            } elif ring.risk_level == "HIGH" {
                c_max_risk = "HIGH";
            } elif ring.risk_level == "MEDIUM" and c_max_risk == "LOW" {
                c_max_risk = "MEDIUM";
            }
        }

        # Patient evidence
        pat_findings = provider_patients.get(pid, []);
        p_flagged    = len(pat_findings);
        p_high_cnt   = 0;
        p_flags_seen: list[str] = [];
        for pf in pat_findings {
            if pf.risk_level == "HIGH" { p_high_cnt += 1; }
            for flag in pf.flags {
                if flag not in p_flags_seen { p_flags_seen.append(flag); }
            }
        }

        # Assemble human-readable finding lists
        billing_strs: list[str] = [];
        if b_risk {
            billing_strs.append(f"risk={b_risk}, anomalies={b_anomalies}");
        }
        collusion_strs: list[str] = [];
        for ring in rings {
            collusion_strs.append(
                f"physician={ring.physician_id}, providers={ring.connected_providers}, "
                f"fraud_in_ring={ring.fraud_providers_in_ring}, "
                f"amount=${ring.total_ring_amount:,.0f}, risk={ring.risk_level}"
            );
        }
        patient_strs: list[str] = [];
        for pf in pat_findings {
            patient_strs.append(
                f"patient={pf.patient_id}, risk={pf.risk_level}, flags={pf.flags}"
            );
        }

        print(f"[synthesis] Synthesizing {pid} "
              f"(billing={b_risk or 'none'}, collusion_rings={c_ring_count}, "
              f"patient_flags={p_flagged})...");

        ::py::
        import time as _t; _t.sleep(2)
        ::py::

        case_file = synthesize_case(
            provider_id          = pid,
            fraud_label          = prov_node.fraud_label,
            total_claims         = prov_node.total_claims,
            total_amount         = prov_node.total_amount,
            billing_risk         = b_risk,
            billing_anomalies    = b_anomalies,
            billing_reasoning    = b_reasoning,
            collusion_ring_count = c_ring_count,
            collusion_physicians = c_physicians,
            collusion_max_risk   = c_max_risk,
            collusion_total_amount = c_total_amt,
            patient_flagged_count  = p_flagged,
            patient_high_count     = p_high_cnt,
            patient_flags_seen     = p_flags_seen,
        );

        # Populate the human-readable finding lists (LLM doesn't build these)
        case_file.billing_findings   = billing_strs;
        case_file.collusion_findings = collusion_strs;
        case_file.patient_findings   = patient_strs;

        case_files.append(case_file);
        print(f"  → overall_risk={case_file.overall_risk_level}, "
              f"estimated_fraud=${case_file.estimated_fraud_amount:,.0f}");
    }

    # ── Summary ──────────────────────────────────────────────────────────
    high_cases:   list[CaseFile] = [];
    med_cases:    list[CaseFile] = [];
    low_cases:    list[CaseFile] = [];
    fraud_total   = 0.0;

    for cf in case_files {
        if cf.overall_risk_level == "HIGH" {
            high_cases.append(cf);
            fraud_total += cf.estimated_fraud_amount;
        } elif cf.overall_risk_level == "MEDIUM" {
            med_cases.append(cf);
        } else {
            low_cases.append(cf);
        }
    }

    print(f"\n[synthesis] ── Case File Summary ─────────────────────────");
    print(f"  Total case files generated : {len(case_files)}");
    print(f"  HIGH risk cases            : {len(high_cases)}");
    print(f"  MEDIUM risk cases          : {len(med_cases)}");
    print(f"  LOW risk cases             : {len(low_cases)}");
    print(f"  Estimated fraud (HIGH)     : ${fraud_total:,.0f}");

    if high_cases {
        print(f"\n  ── HIGH RISK CASES ──────────────────────────────────");
        for cf in high_cases {
            print(f"\n  [{cf.overall_risk_level}] {cf.provider_id}");
            print(f"    Billing     : {cf.billing_findings}");
            print(f"    Collusion   : {cf.collusion_findings}");
            print(f"    Patients    : {len(cf.patient_findings)} flagged");
            print(f"    Action      : {cf.recommended_action}");
            print(f"    Est. Fraud  : ${cf.estimated_fraud_amount:,.0f}");
            print(f"    Reasoning   : {cf.combined_reasoning[:300]}...");
        }
    }

    if med_cases {
        print(f"\n  ── MEDIUM RISK CASES ────────────────────────────────");
        for cf in med_cases {
            print(f"  [MEDIUM] {cf.provider_id} — {cf.recommended_action} "
                  f"(est. ${cf.estimated_fraud_amount:,.0f})");
        }
    }

    print("\n[synthesis] ─────────────────────────────────────────────");
}
