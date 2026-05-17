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

# ---------------------------------------------------------------------------
# Uploaded file detection
# ---------------------------------------------------------------------------

def detect_uploaded_files(upload_dir: str) -> dict | None:
    """
    Scan upload_dir for CSV files and identify which is labels/beneficiary/
    inpatient/outpatient by inspecting column headers.  Returns a FILES-style
    dict, or None if any required file type is missing.
    """
    found: dict[str, str] = {}
    try:
        csvs = [f for f in os.listdir(upload_dir) if f.lower().endswith(".csv")]
    except FileNotFoundError:
        return None

    for fname in csvs:
        path = os.path.join(upload_dir, fname)
        try:
            with open(path, newline="", encoding="utf-8") as fh:
                headers = set(next(csv.reader(fh)))
        except (StopIteration, OSError):
            continue

        if "PotentialFraud" in headers:
            found["labels"] = path
        elif "DOB" in headers and "ClaimID" not in headers:
            found["beneficiary"] = path
        elif "AdmissionDt" in headers:
            found["inpatient"] = path
        elif "ClaimID" in headers and "AdmissionDt" not in headers:
            found["outpatient"] = path

    if all(k in found for k in ("labels", "beneficiary", "inpatient", "outpatient")):
        return found
    return None

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

def _path(key: str, file_map: dict | None = None) -> str:
    if file_map and key in file_map:
        return file_map[key]
    return os.path.join(DATA_DIR, FILES[key])


def _read_csv(key: str, file_map: dict | None = None) -> list[dict]:
    rows = []
    with open(_path(key, file_map), newline="", encoding="utf-8") as fh:
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

def _load_providers(
    non_fraud_sample: int,
    seed: int,
    fraud_sample: int | None = None,
    file_map: dict | None = None,
) -> tuple[set[str], list[dict]]:
    """
    Returns (selected_provider_ids, provider_dicts).
    fraud_sample caps how many fraud providers are included (None = all).
    """
    raw = _read_csv("labels", file_map)
    fraud_providers     = [r for r in raw if r["PotentialFraud"].strip() == "Yes"]
    non_fraud_providers = [r for r in raw if r["PotentialFraud"].strip() == "No"]

    rng = random.Random(seed)
    if fraud_sample is not None:
        fraud_providers = fraud_providers[:fraud_sample]  # deterministic first-N
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

def _load_claims(provider_ids: set[str], file_map: dict | None = None) -> tuple[list[dict], set[str], set[str]]:
    """
    Returns (claim_dicts, bene_ids_seen, physician_ids_seen).
    """
    claims: list[dict]    = []
    bene_ids: set[str]    = set()
    physician_ids: set[str] = set()

    for claim_type, key in [("inpatient", "inpatient"), ("outpatient", "outpatient")]:
        for row in _read_csv(key, file_map):
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

def _load_patients(bene_ids: set[str], file_map: dict | None = None) -> list[dict]:
    patients = []
    for row in _read_csv("beneficiary", file_map):
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
    fraud_sample: int | None = None,
    file_map: dict | None = None,
) -> dict:
    """
    Load and return the development subset of the fraud dataset.

    Returns a dict with keys:
      providers, patients, claims, physicians
    """
    print(f"[loader] Reading provider labels...")
    provider_ids, providers = _load_providers(non_fraud_sample, seed, fraud_sample=fraud_sample, file_map=file_map)
    fraud_count     = sum(1 for p in providers if p["fraud_label"])
    non_fraud_count = len(providers) - fraud_count
    print(f"[loader]   {len(providers)} providers selected "
          f"({fraud_count} fraud, {non_fraud_count} non-fraud)")

    print(f"[loader] Filtering claims to selected providers...")
    claims, bene_ids, physician_ids = _load_claims(provider_ids, file_map=file_map)
    inpatient_count  = sum(1 for c in claims if c["type"] == "inpatient")
    outpatient_count = sum(1 for c in claims if c["type"] == "outpatient")
    print(f"[loader]   {len(claims)} claims "
          f"({inpatient_count} inpatient, {outpatient_count} outpatient)")
    print(f"[loader]   {len(bene_ids)} unique patients, "
          f"{len(physician_ids)} unique physicians")

    print(f"[loader] Loading patient demographics...")
    patients = _load_patients(bene_ids, file_map=file_map)
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
    non_fraud_sample: int = 15,
    claims_per_provider: int = 50,
    seed: int = RANDOM_SEED,
    file_map: dict | None = None,
) -> dict:
    """
    Load a small, graph-ready subset for fast development and testing.

    All filtering and aggregation happens in Python so the Jac graph builder
    only creates nodes for a small representative sample of claims — keeping
    edge counts low enough for Jac to build the graph in under 30 seconds.

    Provider aggregate stats (total_claims, total_amount, etc.) are computed
    from ALL claims before sampling and stored in each provider dict so agents
    see accurate billing volumes even though the graph holds only a sample.

    Returns same schema as load_dataset() plus per-provider aggregates.
    """
    from collections import defaultdict

    # Auto-detect uploaded files from JAC_DATA_DIR env var if file_map not given
    if file_map is None:
        upload_dir = os.environ.get("JAC_DATA_DIR", "")
        if upload_dir:
            detected = detect_uploaded_files(upload_dir)
            if detected:
                print(f"[loader] Using uploaded files from {upload_dir}")
                file_map = detected
            else:
                print(f"[loader] WARNING: uploaded files in {upload_dir} incomplete — using default data")

    # Cap fraud providers so we don't scan claims for hundreds of unused providers
    fraud_cap = max(provider_limit - non_fraud_sample, provider_limit // 2)
    full = load_dataset(non_fraud_sample=non_fraud_sample, seed=seed, fraud_sample=fraud_cap, file_map=file_map)

    providers = full["providers"][:provider_limit]
    prov_ids  = {p["id"] for p in providers}

    all_claims = [c for c in full["claims"] if c["provider_id"] in prov_ids]

    # Pre-compute per-provider stats from ALL claims (Jac will only get a sample)
    stats: dict[str, dict] = defaultdict(lambda: {
        "total_claims": 0, "total_amount": 0.0,
        "inpatient_count": 0, "outpatient_count": 0,
    })
    for c in all_claims:
        pid = c["provider_id"]
        stats[pid]["total_claims"] += 1
        stats[pid]["total_amount"] += c["amount"] or 0.0
        if c["type"] == "inpatient":
            stats[pid]["inpatient_count"] += 1
        else:
            stats[pid]["outpatient_count"] += 1

    for p in providers:
        p.update(stats[p["id"]])

    # Sample up to claims_per_provider claims per provider to limit graph edges
    claims_by_prov: dict[str, list] = defaultdict(list)
    for c in all_claims:
        claims_by_prov[c["provider_id"]].append(c)

    sampled_claims: list[dict] = []
    for pid in prov_ids:
        sampled_claims.extend(claims_by_prov[pid][:claims_per_provider])

    bene_ids  = {c["bene_id"] for c in sampled_claims}
    patients  = [p for p in full["patients"] if p["id"] in bene_ids]
    phys_ids  = {c["attending_physician"] for c in sampled_claims if c["attending_physician"]}
    physicians = [{"id": pid} for pid in sorted(phys_ids)]

    subset = {
        "providers":  providers,
        "patients":   patients,
        "claims":     sampled_claims,
        "physicians": physicians,
    }

    fraud_count = sum(1 for p in providers if p["fraud_label"])
    print(f"[loader] Subset ready: {len(providers)} providers "
          f"({fraud_count} fraud), {len(sampled_claims)} sampled claims "
          f"(of {len(all_claims)} total), "
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
