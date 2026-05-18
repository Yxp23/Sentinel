"""
run_agents.py — Pure Python fraud detection pipeline.
Replaces jac walker execution for fast upload processing (~30s vs 9+ min).
"""

import sys
import os
import json
import datetime
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from loader.load_data import load_subset, detect_uploaded_files


def run_billing_agent(providers, claims):
    """Compute billing anomalies per provider vs peer average."""
    n = len(providers)
    peer_avg_claims = sum(p.get("total_claims", 0) for p in providers) / n if n > 0 else 1.0
    peer_avg_amount = sum(p.get("total_amount", 0.0) for p in providers) / n if n > 0 else 1.0

    print(
        f"[billing] Peer group: {n} providers, "
        f"avg_claims={peer_avg_claims:.0f}, avg_amount=${peer_avg_amount:,.0f}",
        flush=True,
    )

    diag_by_prov = defaultdict(lambda: defaultdict(int))
    for c in claims:
        for code in c.get("diagnosis_codes", []):
            diag_by_prov[c["provider_id"]][code] += 1

    findings = {}

    for p in providers:
        pid = p["id"]
        total_claims = p.get("total_claims", 0)
        total_amount = p.get("total_amount", 0.0)

        claims_ratio = total_claims / peer_avg_claims if peer_avg_claims > 0 else 0.0
        amount_ratio = total_amount / peer_avg_amount if peer_avg_amount > 0 else 0.0
        max_ratio = max(claims_ratio, amount_ratio)

        if max_ratio <= 1.5:
            print(
                f"[billing] {pid} skipped - within normal range "
                f"(claims_ratio={claims_ratio:.2f}, amount_ratio={amount_ratio:.2f})",
                flush=True,
            )
            continue

        avg_claim_amt = total_amount / total_claims if total_claims > 0 else 0.0
        dc = diag_by_prov[pid]
        top_diag = sorted(dc.keys(), key=lambda k: dc[k], reverse=True)[:5]
        unique_diag = list(dict.fromkeys(top_diag))

        anomalies = []
        if claims_ratio > 3.0:
            anomalies.append(
                f"Very high claims ratio ({claims_ratio:.3f}) vs peer average (1.0) — possible phantom billing"
            )
        elif claims_ratio > 1.5:
            anomalies.append(
                f"High claims ratio ({claims_ratio:.3f}) compared to peer average (1.0)"
            )
        if amount_ratio > 3.0:
            anomalies.append(
                f"Very high amount ratio ({amount_ratio:.3f}) vs peer average (1.0) — possible upcoding"
            )
        elif amount_ratio > 1.5:
            anomalies.append(
                f"High amount ratio ({amount_ratio:.3f}) compared to peer average (1.0)"
            )
        if len(unique_diag) <= 3 and (claims_ratio > 1.5 or amount_ratio > 1.5):
            anomalies.append(
                f"Narrow set of diagnosis codes (top codes include {', '.join(unique_diag[:4])}) suggesting potential upcoding"
            )

        if claims_ratio > 3.0 or amount_ratio > 3.0:
            risk = "HIGH"
        elif claims_ratio > 1.5 or amount_ratio > 1.5:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        if risk == "HIGH" and max_ratio < 2.5:
            risk = "MEDIUM"
        elif risk == "LOW" and max_ratio >= 3.0:
            risk = "MEDIUM"

        reasoning = (
            f"Provider {pid} billed {total_claims} claims totalling ${total_amount:,.0f} "
            f"(claims_ratio={claims_ratio:.3f}x, amount_ratio={amount_ratio:.3f}x peer average, "
            f"avg ${avg_claim_amt:,.0f}/claim). "
            + (
                ("Anomalies: " + "; ".join(anomalies) + ".")
                if anomalies
                else "No significant billing anomalies detected."
            )
        )

        findings[pid] = {"risk_level": risk, "anomalies": anomalies, "reasoning": reasoning}

        print(
            f"[billing] Assessing {pid} "
            f"(claims={total_claims} [{claims_ratio:.1f}x], "
            f"amount=${total_amount:,.0f} [{amount_ratio:.1f}x], "
            f"label={'Yes' if p['fraud_label'] else 'No'})...",
            flush=True,
        )
        print(f"  → risk={risk}\n", flush=True)

    print(f"[billing] Found {len(findings)} providers with anomalies", flush=True)
    return findings


def run_collusion_agent(providers, claims):
    """Find physicians shared between 2+ providers (collusion rings)."""
    prov_fraud = {p["id"]: p["fraud_label"] for p in providers}

    phys_to_provs = defaultdict(set)
    phys_claim_counts = defaultdict(int)
    phys_amounts = defaultdict(float)

    _invalid = {"NA", "N/A", "NONE", "NULL", ""}

    for c in claims:
        pid = c["provider_id"]
        for phys in [
            c.get("attending_physician"),
            c.get("operating_physician"),
            c.get("other_physician"),
        ]:
            if phys and phys.upper() not in _invalid:
                phys_to_provs[phys].add(pid)
                phys_claim_counts[phys] += 1
                phys_amounts[phys] += c.get("amount") or 0.0

    print(f"[collusion] Mapped {len(phys_to_provs)} physicians to providers", flush=True)

    shared = [phys for phys, provs in phys_to_provs.items() if len(provs) >= 2]
    print(f"[collusion] Found {len(shared)} physicians shared between 2+ providers\n", flush=True)

    rings = []

    for phys_id in shared:
        provs_list = sorted(phys_to_provs[phys_id])
        fraud_provs = [p for p in provs_list if prov_fraud.get(p, False)]
        non_fraud_provs = [p for p in provs_list if not prov_fraud.get(p, False)]

        if not fraud_provs:
            continue

        total_amount = phys_amounts[phys_id]
        claim_count = phys_claim_counts[phys_id]
        fc = len(fraud_provs)
        tc = len(provs_list)
        ff = fc / tc if tc > 0 else 0.0

        if tc >= 3 and ff > 0.5 and total_amount > 50000:
            risk = "HIGH"
        elif fc >= 2 or (total_amount > 20000 and fc >= 1):
            risk = "MEDIUM"
        else:
            risk = "LOW"

        if risk == "HIGH" and (ff < 0.5 or total_amount < 50000.0):
            risk = "MEDIUM"
        elif risk == "MEDIUM" and ff == 0.0:
            risk = "LOW"

        reasoning = (
            f"Physician {phys_id} appears on claims from {tc} provider(s) "
            f"({fc} fraud-labeled, {len(non_fraud_provs)} non-fraud). "
            f"Total ring amount: ${total_amount:,.0f}, shared claim count: {claim_count}. "
            + (
                f"Fraud fraction {ff:.0%} and high dollar flow indicate coordinated billing."
                if risk == "HIGH"
                else "Partial fraud overlap warrants monitoring."
                if risk == "MEDIUM"
                else "Pattern consistent with legitimate group practice."
            )
        )

        rings.append(
            {
                "physician_id": phys_id,
                "connected_providers": provs_list,
                "fraud_providers_in_ring": fraud_provs,
                "non_fraud_providers_in_ring": non_fraud_provs,
                "shared_claim_count": claim_count,
                "total_ring_amount": total_amount,
                "risk_level": risk,
                "reasoning": reasoning,
            }
        )

        print(
            f"[collusion] Assessing physician {phys_id} "
            f"(shared by {tc} providers, {fc} fraud, ${total_amount:,.0f} total)...",
            flush=True,
        )
        print(f"  → risk={risk}, reasoning={reasoning[:150]}...\n", flush=True)

    print(f"[collusion] Found {len(rings)} collusion rings", flush=True)
    return rings


def run_patient_agent(providers, claims, patients):
    """Detect per-patient fraud patterns."""
    prov_fraud = {p["id"]: p["fraud_label"] for p in providers}
    deceased_lookup = {
        pat["id"]: {"deceased": pat["deceased"], "dod": pat.get("dod") or ""}
        for pat in patients
    }

    pat_providers = defaultdict(list)
    pat_claim_counts = defaultdict(int)
    pat_amounts = defaultdict(float)
    pat_dates = defaultdict(list)

    for c in claims:
        bene = c["bene_id"]
        pid = c["provider_id"]
        if pid not in pat_providers[bene]:
            pat_providers[bene].append(pid)
        pat_claim_counts[bene] += 1
        pat_amounts[bene] += c.get("amount") or 0.0
        if c.get("claim_start"):
            pat_dates[bene].append(c["claim_start"])

    print(f"[patient] Collected stats for {len(pat_providers)} patients\n", flush=True)

    findings = []
    assessed = skipped = 0

    for bene, provider_list in pat_providers.items():
        claim_cnt = pat_claim_counts[bene]
        total_amt = pat_amounts[bene]
        dates = pat_dates[bene]
        prov_count = len(provider_list)

        fraud_prov_count = sum(1 for pid in provider_list if prov_fraud.get(pid, False))

        pat_info = deceased_lookup.get(bene, {})
        deceased = pat_info.get("deceased", False)
        dod_str = pat_info.get("dod", "") or ""
        post_death = False

        if deceased and dod_str and dates:
            latest = max(dates)
            if latest > dod_str:
                post_death = True

        computed_flags = []
        if prov_count >= 3:
            computed_flags.append("multi_provider")
        if claim_cnt >= 10:
            computed_flags.append("high_volume")
        if post_death:
            computed_flags.append("post_death_claim")
        if fraud_prov_count >= 2:
            computed_flags.append("fraud_provider_overlap")

        if not computed_flags:
            skipped += 1
            continue

        avg_claim_amt = total_amt / claim_cnt if claim_cnt > 0 else 0.0
        latest_date = max(dates) if dates else ""
        flags_txt = ", ".join(computed_flags)

        print(
            f"[patient] Assessing {bene} "
            f"(providers={prov_count}, claims={claim_cnt}, "
            f"amount=${total_amt:,.0f}, flags={computed_flags})...",
            flush=True,
        )

        if post_death:
            risk = "HIGH"
            reasoning = (
                f"Patient {bene} has post-death claims (DOD: {dod_str}, latest claim: {latest_date}). "
                "Billing after recorded death is definitive fraud."
            )
        elif fraud_prov_count >= 3 and total_amt > 10000:
            risk = "HIGH"
            reasoning = (
                f"Patient {bene} billed by {fraud_prov_count} fraud-labeled providers "
                f"(${total_amt:,.0f} total). Flags: {flags_txt}."
            )
        elif prov_count >= 4:
            risk = "HIGH"
            reasoning = (
                f"Patient {bene} appears at {prov_count} different providers "
                f"(${total_amt:,.0f} total, {claim_cnt} claims). Flags: {flags_txt}."
            )
        elif (
            (fraud_prov_count >= 2 and 2000 <= total_amt <= 10000)
            or (claim_cnt >= 10 and fraud_prov_count >= 1)
            or prov_count >= 3
        ):
            risk = "MEDIUM"
            reasoning = (
                f"Patient {bene}: {fraud_prov_count} fraud provider(s) out of {prov_count} total, "
                f"${total_amt:,.0f} billed, {claim_cnt} claims. Flags: {flags_txt}."
            )
        else:
            risk = "LOW"
            reasoning = (
                f"Patient {bene}: limited fraud overlap ({fraud_prov_count} fraud providers), "
                f"${total_amt:,.0f} total. Borderline flags: {flags_txt}."
            )

        if post_death:
            risk = "HIGH"
        elif risk == "HIGH" and total_amt < 2000.0:
            risk = "MEDIUM"
        elif risk == "HIGH" and prov_count == 2 and fraud_prov_count == 2 and total_amt < 10000.0:
            risk = "MEDIUM"

        findings.append(
            {
                "patient_id": bene,
                "risk_level": risk,
                "flags": computed_flags,
                "reasoning": reasoning,
                "_provider_list": provider_list,
            }
        )
        assessed += 1
        print(f"  → risk={risk}, flags={computed_flags}\n", flush=True)

    print(f"[patient] Assessed: {assessed}, skipped: {skipped}", flush=True)
    return findings


def _pd(s):
    if not s:
        return None
    try:
        return datetime.datetime.strptime(s.strip(), "%Y-%m-%d").date()
    except Exception:
        return None


def run_temporal_agent(providers, claims, patients):
    """Detect temporal anomalies in patient claim patterns."""
    prov_fraud = {p["id"]: p["fraud_label"] for p in providers}
    deceased_lookup = {
        pat["id"]: {"deceased": pat["deceased"], "dod": pat.get("dod") or ""}
        for pat in patients
    }

    pat_claims = defaultdict(list)
    for c in claims:
        pat_claims[c["bene_id"]].append(
            {
                "provider_id": c["provider_id"],
                "claim_start": c.get("claim_start") or "",
                "claim_end": c.get("claim_end") or "",
                "claim_type": c.get("type", "outpatient"),
            }
        )

    print(f"[temporal] Collected claims for {len(pat_claims)} patients", flush=True)

    findings = []
    assessed = skipped = 0

    for bene, bene_claims in pat_claims.items():
        pat_info = deceased_lookup.get(bene, {})
        deceased = pat_info.get("deceased", False)
        dod_str = pat_info.get("dod", "") or ""

        atypes = []
        iprovs = set()
        evid = []

        # 1. Post-death claims
        if deceased and dod_str:
            dod_d = _pd(dod_str)
            if dod_d:
                dead_claims = [
                    c
                    for c in bene_claims
                    if _pd(c["claim_start"]) and _pd(c["claim_start"]) > dod_d
                ]
                if dead_claims:
                    atypes.append("post_death_claim")
                    for c in dead_claims:
                        iprovs.add(c["provider_id"])
                    ds = sorted(set(c["claim_start"] for c in dead_claims))
                    evid.append(
                        f"Patient died {dod_str}; "
                        f"{len(dead_claims)} claim(s) filed after death on: {', '.join(ds)}"
                    )

        # 2. Overlapping inpatient stays
        inp = [
            (c["provider_id"], _pd(c["claim_start"]), _pd(c["claim_end"]))
            for c in bene_claims
            if c["claim_type"] == "inpatient" and _pd(c["claim_start"]) and _pd(c["claim_end"])
        ]
        for i in range(len(inp)):
            for j in range(i + 1, len(inp)):
                p1, s1, e1 = inp[i]
                p2, s2, e2 = inp[j]
                if p1 != p2:
                    olap_s = max(s1, s2)
                    olap_e = min(e1, e2)
                    if olap_s <= olap_e:
                        if "overlapping_stays" not in atypes:
                            atypes.append("overlapping_stays")
                        iprovs.update([p1, p2])
                        evid.append(
                            f"Overlapping stays: {p1}({s1}→{e1}) and "
                            f"{p2}({s2}→{e2}) overlap {olap_s}→{olap_e}"
                        )

        # 3. Claim burst: 5+ claims from same provider within 7 days
        by_prov = defaultdict(list)
        for c in bene_claims:
            d = _pd(c["claim_start"])
            if d:
                by_prov[c["provider_id"]].append(d)

        for p, pdates in by_prov.items():
            pdates_s = sorted(pdates)
            for k in range(len(pdates_s)):
                win = [d for d in pdates_s if 0 <= (d - pdates_s[k]).days <= 6]
                if len(win) >= 5:
                    if "claim_burst" not in atypes:
                        atypes.append("claim_burst")
                    iprovs.add(p)
                    evid.append(
                        f"Claim burst: {p} submitted {len(win)} claims "
                        f"in 7 days ({pdates_s[k]}→{win[-1]})"
                    )
                    break

        # 4. Patient shuttling: 2+ same-day discharge→admit transitions
        evts = []
        for c in bene_claims:
            s = _pd(c["claim_start"])
            e = _pd(c["claim_end"])
            p = c["provider_id"]
            if s:
                evts.append((s, 1, p))
            if e:
                evts.append((e, 0, p))
        evts.sort()

        sht_count = 0
        sht_provs = set()
        for k in range(len(evts) - 1):
            d1, t1, p1 = evts[k]
            d2, t2, p2 = evts[k + 1]
            if t1 == 0 and t2 == 1 and d1 == d2 and p1 != p2:
                sht_count += 1
                sht_provs.update([p1, p2])
        if sht_count >= 2:
            atypes.append("patient_shuttling")
            iprovs.update(sht_provs)
            evid.append(
                f"Patient shuttling: {sht_count} same-day discharge→admission "
                f"transitions between providers {sorted(sht_provs)}"
            )

        if not atypes:
            skipped += 1
            continue

        iprovs_list = sorted(iprovs)
        timeline = "; ".join(evid)
        priority = ["post_death_claim", "overlapping_stays", "patient_shuttling", "claim_burst"]
        primary = next((t for t in priority if t in atypes), atypes[0])
        fpc = sum(1 for pid in iprovs_list if prov_fraud.get(pid, False))

        if "post_death_claim" in atypes:
            risk = "HIGH"
            reasoning = (
                f"Post-death billing detected for patient {bene} (DOD: {dod_str}). "
                f"Claims filed after recorded death — definitive fraud. Evidence: {timeline}"
            )
        elif "overlapping_stays" in atypes and fpc >= 1:
            risk = "HIGH"
            reasoning = (
                f"Overlapping inpatient stays involving {fpc} fraud-labeled provider(s). "
                f"At least one claim must be fabricated. Evidence: {timeline}"
            )
        elif "patient_shuttling" in atypes and fpc >= 2:
            risk = "HIGH"
            reasoning = (
                f"Patient shuttling between {fpc} fraud-labeled providers. "
                f"Coordinated rotation billing pattern. Evidence: {timeline}"
            )
        elif (
            "overlapping_stays" in atypes
            or ("patient_shuttling" in atypes and fpc >= 1)
            or ("claim_burst" in atypes and fpc >= 1)
        ):
            risk = "MEDIUM"
            reasoning = (
                f"Temporal anomaly ({', '.join(atypes)}) involving {fpc} fraud provider(s). "
                f"Evidence: {timeline}"
            )
        else:
            risk = "LOW"
            reasoning = (
                f"Minor temporal anomaly ({', '.join(atypes)}) involving non-fraud providers. "
                f"Evidence: {timeline}"
            )

        if "post_death_claim" in atypes:
            risk = "HIGH"
        elif "overlapping_stays" in atypes and risk == "LOW":
            risk = "MEDIUM"

        findings.append(
            {
                "patient_id": bene,
                "anomaly_type": primary,
                "involved_providers": iprovs_list,
                "timeline_evidence": timeline,
                "risk_level": risk,
                "reasoning": reasoning,
            }
        )
        assessed += 1
        print(f"[temporal] {bene}: types={atypes}, providers={iprovs_list}", flush=True)
        print(f"  → risk={risk}, type={primary}\n", flush=True)

    print(f"[temporal] Assessed: {assessed}, skipped: {skipped}", flush=True)
    return findings


def run_synthesis(providers, billing_findings, collusion_rings, patient_findings, temporal_findings):
    """Build per-provider case files."""
    pat_by_prov = defaultdict(list)
    for pf in patient_findings:
        for pid in pf.get("_provider_list", []):
            pat_by_prov[pid].append(pf)

    temp_by_prov = defaultdict(list)
    for tf in temporal_findings:
        for pid in tf["involved_providers"]:
            temp_by_prov[pid].append(tf)

    coll_by_prov = defaultdict(list)
    for ring in collusion_rings:
        for pid in ring["connected_providers"]:
            coll_by_prov[pid].append(ring)

    case_files = []
    high_risk_count = medium_risk_count = 0
    estimated_fraud_total = 0.0

    for prov in providers:
        pid = prov["id"]
        total_claims = prov.get("total_claims", 0)
        total_amount = prov.get("total_amount", 0.0)
        fraud_label = prov["fraud_label"]

        b = billing_findings.get(pid)
        c_rings = coll_by_prov.get(pid, [])
        p_list = pat_by_prov.get(pid, [])
        t_list = temp_by_prov.get(pid, [])

        b_risk = b["risk_level"] if b else "LOW"
        billing_high = b_risk == "HIGH"
        billing_medium = b_risk in ("HIGH", "MEDIUM")
        collusion_high = any(r["risk_level"] == "HIGH" for r in c_rings)
        patient_storm = sum(1 for pf in p_list if pf["risk_level"] == "HIGH") >= 3
        temporal_high = any(tf["risk_level"] == "HIGH" for tf in t_list)
        corroborated = len(c_rings) > 0 or len(p_list) > 0 or len(t_list) > 0

        if (billing_high and corroborated) or collusion_high or temporal_high or patient_storm:
            overall_risk = "HIGH"
        elif billing_medium or len(c_rings) > 0 or len(p_list) > 0 or len(t_list) > 0:
            overall_risk = "MEDIUM"
        else:
            overall_risk = "LOW"


        if overall_risk == "LOW" and not fraud_label:
            continue

        est_fraud = total_amount if overall_risk == "HIGH" else (total_amount * 0.3 if overall_risk == "MEDIUM" else 0.0)

        parts = []
        if b:
            parts.append(f"Billing: {b['reasoning']}")
        if c_rings:
            parts.append(
                "Collusion: "
                + "; ".join(
                    f"physician {r['physician_id']} links {len(r['connected_providers'])} providers"
                    for r in c_rings[:2]
                )
                + "."
            )
        if p_list:
            high_p = sum(1 for pf in p_list if pf["risk_level"] == "HIGH")
            parts.append(f"Patient patterns: {len(p_list)} flagged patients ({high_p} HIGH risk).")
        if t_list:
            high_t = sum(1 for tf in t_list if tf["risk_level"] == "HIGH")
            parts.append(f"Temporal: {len(t_list)} anomalies detected ({high_t} HIGH risk).")
        combined_reasoning = (
            " ".join(parts)
            if parts
            else f"Provider {pid} assessed across all agents with no significant findings."
        )

        if overall_risk == "HIGH":
            recommended_action = (
                f"Immediately refer {pid} for full audit. "
                "High-confidence fraud indicators detected across multiple agents."
            )
        elif overall_risk == "MEDIUM":
            recommended_action = (
                f"Schedule enhanced monitoring for {pid}. "
                "Multiple soft fraud signals warrant closer review."
            )
        else:
            recommended_action = f"Continue routine monitoring for {pid}."

        case_files.append(
            {
                "provider_id": pid,
                "overall_risk_level": overall_risk,
                "fraud_label": fraud_label,
                "total_claims": total_claims,
                "total_amount": total_amount,
                "billing_findings": [f"risk={b['risk_level']}, anomalies={b['anomalies']}"] if b else [],
                "collusion_findings": [
                    f"physician={r['physician_id']}, ring_size={len(r['connected_providers'])}, "
                    f"fraud_providers={r['fraud_providers_in_ring']}, risk={r['risk_level']}"
                    for r in c_rings
                ],
                "patient_findings": [
                    f"patient={pf['patient_id']}, risk={pf['risk_level']}, flags={pf['flags']}"
                    for pf in p_list
                ],
                "temporal_findings": [
                    f"patient={tf['patient_id']}, type={tf['anomaly_type']}, risk={tf['risk_level']}"
                    for tf in t_list
                ],
                "combined_reasoning": combined_reasoning,
                "recommended_action": recommended_action,
                "estimated_fraud_amount": est_fraud,
                "agent_signals": {
                    "billing": b is not None,
                    "collusion": len(c_rings) > 0,
                    "patient": len(p_list) > 0,
                    "temporal": len(t_list) > 0,
                },
                "billing_detail": b,
                "collusion_detail": c_rings,
                "patient_detail": [
                    {k: v for k, v in pf.items() if k != "_provider_list"} for pf in p_list
                ],
                "temporal_detail": t_list,
            }
        )

        if overall_risk == "HIGH":
            high_risk_count += 1
            estimated_fraud_total += est_fraud
        elif overall_risk == "MEDIUM":
            medium_risk_count += 1

    risk_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    case_files.sort(
        key=lambda x: (risk_order.get(x["overall_risk_level"], 3), not x["fraud_label"], -x["total_amount"])
    )

    print(f"[synthesis] Built {len(case_files)} case files", flush=True)

    return {
        "meta": {
            "provider_count": len(providers),
            "case_count": len(case_files),
            "high_risk_count": high_risk_count,
            "medium_risk_count": medium_risk_count,
            "estimated_fraud_total": estimated_fraud_total,
            "collusion_rings": len([r for r in collusion_rings if r["risk_level"] in ("HIGH", "MEDIUM")]),
            "temporal_anomalies": len([tf for tf in temporal_findings if tf["risk_level"] in ("HIGH", "MEDIUM")]),
        },
        "case_files": case_files,
    }


def main(upload_dir=None):
    file_map = None
    if upload_dir:
        file_map = detect_uploaded_files(upload_dir)
        if file_map:
            print(f"[run_agents] Using uploaded files from {upload_dir}", flush=True)
        else:
            print(f"[run_agents] WARNING: couldn't detect uploaded files — using default data", flush=True)

    if upload_dir:
        provider_limit = 200
        non_fraud_sample = 100
        claims_per_provider = 50
    else:
        provider_limit = 200
        non_fraud_sample = 500
        claims_per_provider = 50

    print("[run_agents] Loading dataset...", flush=True)
    data = load_subset(
        provider_limit=provider_limit,
        non_fraud_sample=non_fraud_sample,
        claims_per_provider=claims_per_provider,
        file_map=file_map,
    )

    providers = data["providers"]
    claims = data["claims"]
    patients = data["patients"]
    print(
        f"[run_agents] Loaded {len(providers)} providers, {len(claims)} claims, {len(patients)} patients",
        flush=True,
    )

    print("\n[run_agents] === BILLING AGENT ===", flush=True)
    billing = run_billing_agent(providers, claims)

    print("\n[run_agents] === COLLUSION AGENT ===", flush=True)
    collusion = run_collusion_agent(providers, claims)

    print("\n[run_agents] === PATIENT AGENT ===", flush=True)
    patient = run_patient_agent(providers, claims, patients)

    print("\n[run_agents] === TEMPORAL AGENT ===", flush=True)
    temporal = run_temporal_agent(providers, claims, patients)

    print("\n[run_agents] === SYNTHESIS ===", flush=True)
    results = run_synthesis(providers, billing, collusion, patient, temporal)

    out_path = ROOT / "output" / "results.json"
    out_path.parent.mkdir(exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    meta = results["meta"]
    print(f"\n[run_agents] ── results.json written ──────────────────────────", flush=True)
    print(f"  Providers scanned : {meta['provider_count']}", flush=True)
    print(f"  Case files        : {meta['case_count']}", flush=True)
    print(f"  HIGH risk         : {meta['high_risk_count']}", flush=True)
    print(f"  MEDIUM risk       : {meta['medium_risk_count']}", flush=True)
    print(f"  Est. fraud (HIGH) : ${meta['estimated_fraud_total']:,.0f}", flush=True)
    print(f"  Collusion rings   : {meta['collusion_rings']}", flush=True)
    print(f"  Temporal anomalies: {meta['temporal_anomalies']}", flush=True)
    print(f"[run_agents] ──────────────────────────────────────────────────", flush=True)


if __name__ == "__main__":
    upload_dir = None
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--upload_dir" and i + 1 < len(args):
            upload_dir = args[i + 1]
    main(upload_dir=upload_dir)
