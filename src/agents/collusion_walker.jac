"""
Collusion Walker definitions — imported by collusion_agent.jac and synthesis_agent.jac.
No `with entry` block here so imports do not trigger side effects.
"""

include src.graph.schema;

obj CollusionRing {
    has physician_id: str,
        connected_providers: list[str],
        fraud_providers_in_ring: list[str],
        non_fraud_providers_in_ring: list[str],
        shared_claim_count: int,
        total_ring_amount: float,
        risk_level: str,
        reasoning: str;
}

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

walker CollusionAgent {
    has phys_to_providers: dict = {},
        phys_claim_counts: dict = {},
        phys_amounts: dict = {},
        provider_info: dict = {},
        findings: list[CollusionRing] = [];

    can on_root with Root entry {
        for prov in [-->] {
            self.provider_info[prov.id] = {
                "id": prov.id,
                "fraud_label": prov.fraud_label,
                "total_claims": prov.total_claims,
                "total_amount": prov.total_amount
            };

            for claim in [prov -->] {
                for phys in [claim -->] {
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

        print(f"[collusion] Mapped {len(self.phys_to_providers)} physicians to providers");

        shared_physicians = [];
        for phys_id in self.phys_to_providers {
            providers_list = self.phys_to_providers[phys_id];
            if len(providers_list) >= 2 {
                shared_physicians.append(phys_id);
            }
        }

        print(f"[collusion] Found {len(shared_physicians)} physicians shared between 2+ providers\n");

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
