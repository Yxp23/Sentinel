"""
Healthcare fraud dataset loader.

Reads the 4 Train CSVs, samples a development subset (all fraud providers +
~500 random non-fraud providers), filters claims to those providers, and
returns clean Python dicts/lists ready for the Jac graph builder.

Output schema:
  {
    "providers": list[dict],      # {id, fraud_label}
    "patients":  list[dict],      # {id, dob, age, gender, state, chronic_conditions, ...}
    "claims":    list[dict],      # {id, bene_id, provider_id, attending_physician,
                                  #  operating_physician, other_physician, amount,
                                  #  claim_start, claim_end, los_days,
                                  #  diagnosis_codes, procedure_codes, type}
    "physicians": list[dict],     # {id}
  }
"""

import csv
import os
import random
from datetime import datetime, date

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")

FILES = {
    "labels":      "Train-1542865627584.csv",
    "beneficiary": "Train_Beneficiarydata-1542865627584.csv",
    "inpatient":   "Train_Inpatientdata-1542865627584.csv",
    "outpatient":  "Train_Outpatientdata-1542865627584.csv",
}

# Chronic condition column names → human-readable label
CHRONIC_COLS = {
    "ChronicCond_Alzheimer":          "Alzheimer",
    "ChronicCond_Heartfailure":       "HeartFailure",
    "ChronicCond_KidneyDisease":      "KidneyDisease",
    "ChronicCond_Cancer":             "Cancer",
    "ChronicCond_ObstrPulmonary":     "COPD",
    "ChronicCond_Depression":         "Depression",
    "ChronicCond_Diabetes":           "Diabetes",
    "ChronicCond_IschemicHeart":      "IschemicHeart",
    "ChronicCond_Osteoporasis":       "Osteoporosis",
    "ChronicCond_rheumatoidarthritis":"RheumatoidArthritis",
    "ChronicCond_stroke":             "Stroke",
}

DIAGNOSIS_COLS  = [f"ClmDiagnosisCode_{i}" for i in range(1, 11)]
PROCEDURE_COLS  = [f"ClmProcedureCode_{i}" for i in range(1, 7)]

RANDOM_SEED     = 42
NON_FRAUD_SAMPLE = 500

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _path(key: str) -> str:
    return os.path.join(DATA_DIR, FILES[key])


def _read_csv(key: str) -> list[dict]:
    rows = []
    with open(_path(key), newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rows.append(row)
    return rows


def _parse_date(val: str) -> str | None:
    """Return ISO date string or None."""
    v = (val or "").strip()
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _parse_float(val: str) -> float | None:
    v = (val or "").strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _parse_int(val: str) -> int | None:
    v = (val or "").strip()
    if not v:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def _age_from_dob(dob_str: str | None, reference: date | None = None) -> int | None:
    """Compute age in years from ISO date string."""
    if not dob_str:
        return None
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        ref = reference or date(2009, 12, 31)   # dataset is ~2009
        return (ref - dob).days // 365
    except ValueError:
        return None


def _los_days(start: str | None, end: str | None) -> int | None:
    """Length-of-stay in days between two ISO date strings."""
    if not start or not end:
        return None
    try:
        s = datetime.strptime(start, "%Y-%m-%d")
        e = datetime.strptime(end, "%Y-%m-%d")
        return max(0, (e - s).days)
    except ValueError:
        return None


def _codes(row: dict, cols: list[str]) -> list[str]:
    """Extract non-empty code values from a row."""
    return [row[c].strip() for c in cols if row.get(c, "").strip()]

# ---------------------------------------------------------------------------
# Step 1 — Provider labels + sampling
# ---------------------------------------------------------------------------

def _load_providers(non_fraud_sample: int, seed: int) -> tuple[set[str], list[dict]]:
    """
    Returns (selected_provider_ids, provider_dicts).
    All fraud providers are included; non-fraud are randomly sampled.
    """
    raw = _read_csv("labels")
    fraud_providers     = [r for r in raw if r["PotentialFraud"].strip() == "Yes"]
    non_fraud_providers = [r for r in raw if r["PotentialFraud"].strip() == "No"]

    rng = random.Random(seed)
    sampled_non_fraud = rng.sample(
        non_fraud_providers,
        min(non_fraud_sample, len(non_fraud_providers))
    )

    selected = fraud_providers + sampled_non_fraud
    provider_dicts = [
        {
            "id":          r["Provider"].strip(),
            "fraud_label": r["PotentialFraud"].strip() == "Yes",
        }
        for r in selected
    ]
    selected_ids = {p["id"] for p in provider_dicts}
    return selected_ids, provider_dicts

# ---------------------------------------------------------------------------
# Step 2 — Claims (inpatient + outpatient), filtered to selected providers
# ---------------------------------------------------------------------------

def _load_claims(provider_ids: set[str]) -> tuple[list[dict], set[str], set[str]]:
    """
    Returns (claim_dicts, bene_ids_seen, physician_ids_seen).
    """
    claims: list[dict]    = []
    bene_ids: set[str]    = set()
    physician_ids: set[str] = set()

    for claim_type, key in [("inpatient", "inpatient"), ("outpatient", "outpatient")]:
        for row in _read_csv(key):
            pid = row.get("Provider", "").strip()
            if pid not in provider_ids:
                continue

            bene_id    = row.get("BeneID", "").strip()
            claim_id   = row.get("ClaimID", "").strip()
            start      = _parse_date(row.get("ClaimStartDt", ""))
            end        = _parse_date(row.get("ClaimEndDt", ""))
            amount     = _parse_float(row.get("InscClaimAmtReimbursed", ""))
            attending  = row.get("AttendingPhysician", "").strip() or None
            operating  = row.get("OperatingPhysician", "").strip() or None
            other      = row.get("OtherPhysician", "").strip() or None

            # Inpatient-specific dates
            if claim_type == "inpatient":
                admit    = _parse_date(row.get("AdmissionDt", ""))
                discharge= _parse_date(row.get("DischargeDt", ""))
                los      = _los_days(admit, discharge)
            else:
                admit    = None
                discharge= None
                los      = _los_days(start, end)

            diag_codes = _codes(row, DIAGNOSIS_COLS)
            proc_codes = _codes(row, PROCEDURE_COLS)

            claims.append({
                "id":                   claim_id,
                "bene_id":              bene_id,
                "provider_id":          pid,
                "attending_physician":  attending,
                "operating_physician":  operating,
                "other_physician":      other,
                "amount":               amount,
                "claim_start":          start,
                "claim_end":            end,
                "admission_dt":         admit,
                "discharge_dt":         discharge,
                "los_days":             los,
                "diagnosis_codes":      diag_codes,
                "procedure_codes":      proc_codes,
                "type":                 claim_type,
            })

            bene_ids.add(bene_id)
            for phys in [attending, operating, other]:
                if phys:
                    physician_ids.add(phys)

    return claims, bene_ids, physician_ids

# ---------------------------------------------------------------------------
# Step 3 — Patients (beneficiaries), filtered to seen bene_ids
# ---------------------------------------------------------------------------

def _load_patients(bene_ids: set[str]) -> list[dict]:
    patients = []
    for row in _read_csv("beneficiary"):
        bene_id = row.get("BeneID", "").strip()
        if bene_id not in bene_ids:
            continue

        dob = _parse_date(row.get("DOB", ""))
        dod = _parse_date(row.get("DOD", ""))
        age = _age_from_dob(dob)

        gender_raw = _parse_int(row.get("Gender", ""))
        gender = "M" if gender_raw == 1 else ("F" if gender_raw == 2 else None)

        # Chronic conditions: value 2 = has condition
        chronic = [
            label
            for col, label in CHRONIC_COLS.items()
            if _parse_int(row.get(col, "")) == 2
        ]

        patients.append({
            "id":                    bene_id,
            "dob":                   dob,
            "dod":                   dod,
            "age":                   age,
            "gender":                gender,
            "state":                 _parse_int(row.get("State", "")),
            "county":                _parse_int(row.get("County", "")),
            "chronic_conditions":    chronic,
            "ip_annual_reimbursed":  _parse_float(row.get("IPAnnualReimbursementAmt", "")),
            "op_annual_reimbursed":  _parse_float(row.get("OPAnnualReimbursementAmt", "")),
            "ip_annual_deductible":  _parse_float(row.get("IPAnnualDeductibleAmt", "")),
            "op_annual_deductible":  _parse_float(row.get("OPAnnualDeductibleAmt", "")),
            "months_part_a":         _parse_int(row.get("NoOfMonths_PartACov", "")),
            "months_part_b":         _parse_int(row.get("NoOfMonths_PartBCov", "")),
            "deceased":              dod is not None,
        })
    return patients

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_dataset(
    non_fraud_sample: int = NON_FRAUD_SAMPLE,
    seed: int = RANDOM_SEED,
) -> dict:
    """
    Load and return the development subset of the fraud dataset.

    Returns a dict with keys:
      providers, patients, claims, physicians
    """
    print(f"[loader] Reading provider labels...")
    provider_ids, providers = _load_providers(non_fraud_sample, seed)
    fraud_count     = sum(1 for p in providers if p["fraud_label"])
    non_fraud_count = len(providers) - fraud_count
    print(f"[loader]   {len(providers)} providers selected "
          f"({fraud_count} fraud, {non_fraud_count} non-fraud)")

    print(f"[loader] Filtering claims to selected providers...")
    claims, bene_ids, physician_ids = _load_claims(provider_ids)
    inpatient_count  = sum(1 for c in claims if c["type"] == "inpatient")
    outpatient_count = sum(1 for c in claims if c["type"] == "outpatient")
    print(f"[loader]   {len(claims)} claims "
          f"({inpatient_count} inpatient, {outpatient_count} outpatient)")
    print(f"[loader]   {len(bene_ids)} unique patients, "
          f"{len(physician_ids)} unique physicians")

    print(f"[loader] Loading patient demographics...")
    patients = _load_patients(bene_ids)
    print(f"[loader]   {len(patients)} patient records loaded")

    physicians = [{"id": pid} for pid in sorted(physician_ids)]

    dataset = {
        "providers":  providers,
        "patients":   patients,
        "claims":     claims,
        "physicians": physicians,
    }

    _print_summary(dataset)
    return dataset


def _print_summary(dataset: dict) -> None:
    print("\n[loader] ── Dataset summary ──────────────────────────")
    print(f"  Providers : {len(dataset['providers']):>6,}")
    print(f"  Patients  : {len(dataset['patients']):>6,}")
    print(f"  Claims    : {len(dataset['claims']):>6,}")
    print(f"  Physicians: {len(dataset['physicians']):>6,}")

    fraud_provs = [p for p in dataset["providers"] if p["fraud_label"]]
    total_amount = sum(
        c["amount"] for c in dataset["claims"] if c["amount"] is not None
    )
    print(f"\n  Fraud providers  : {len(fraud_provs)}")
    print(f"  Total reimbursed : ${total_amount:,.0f}")

    # Sample chronic condition stats
    all_chronic = [c for p in dataset["patients"] for c in p["chronic_conditions"]]
    from collections import Counter
    top = Counter(all_chronic).most_common(5)
    print(f"\n  Top chronic conditions:")
    for cond, cnt in top:
        print(f"    {cond:<25} {cnt:,}")
    print("[loader] ────────────────────────────────────────────\n")


def load_subset(
    provider_limit: int = 30,
    non_fraud_sample: int = 20,
    seed: int = RANDOM_SEED,
) -> dict:
    """
    Load a small, graph-ready subset for fast development and testing.

    All filtering happens in Python so the Jac graph builder only receives
    the exact nodes it needs — no in-Jac iteration over the full dataset.

    Returns the same dict schema as load_dataset() but pre-filtered to
    `provider_limit` providers and their associated claims/patients/physicians.
    """
    full = load_dataset(non_fraud_sample=non_fraud_sample, seed=seed)

    providers = full["providers"][:provider_limit]
    prov_ids  = {p["id"] for p in providers}

    claims    = [c for c in full["claims"]   if c["provider_id"] in prov_ids]
    bene_ids  = {c["bene_id"] for c in claims}
    patients  = [p for p in full["patients"] if p["id"] in bene_ids]
    phys_ids  = {c["attending_physician"] for c in claims if c["attending_physician"]}
    physicians = [{"id": pid} for pid in sorted(phys_ids)]

    subset = {
        "providers":  providers,
        "patients":   patients,
        "claims":     claims,
        "physicians": physicians,
    }

    fraud_count = sum(1 for p in providers if p["fraud_label"])
    print(f"[loader] Subset ready: {len(providers)} providers "
          f"({fraud_count} fraud), {len(claims)} claims, "
          f"{len(patients)} patients, {len(physicians)} physicians")
    return subset


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    dataset = load_dataset()
    # Spot-check: print first fraud provider's claim summary
    fraud_ids = {p["id"] for p in dataset["providers"] if p["fraud_label"]}
    fraud_claims = [c for c in dataset["claims"] if c["provider_id"] in fraud_ids]
    if fraud_claims:
        c = fraud_claims[0]
        print(f"Sample fraud claim: {c['id']}")
        print(f"  Provider  : {c['provider_id']}")
        print(f"  Patient   : {c['bene_id']}")
        print(f"  Amount    : ${c['amount']}")
        print(f"  Type      : {c['type']}")
        print(f"  Diagnoses : {c['diagnosis_codes'][:3]}")
