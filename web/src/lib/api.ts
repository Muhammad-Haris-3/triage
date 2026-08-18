export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "https://triage-jws2.onrender.com";

export type Method = {
  method: string;
  label: string;
  detail: string;
  recommended?: boolean;
  advisory?: string;
  lift_vs_recommended?: number;
  lift_ci?: [number, number];
  distinguishable_from_recommended?: boolean;
  display_rule?: string;
  captured: number | null;
  captured_this_draw: number | null;
  precision: number | null;
  vs_random: number | null;
  difference_vs_recommended?: number;
};

export type Notices = {
  historical: string;
  not_clinical: string;
  cold_start: string;
};

export type Comparison = {
  k: number;
  population: { encounters: number; events: number; base_rate: number };
  expected_if_random: number;
  methods: Method[];
  recommended_method: string;
  note: string;
  notices: Notices;
};

export type Patient = {
  rank: number;
  encounter_id: number;
  age_band: string;
  time_in_hospital: number;
  number_inpatient: number;
  number_emergency: number;
  num_medications: number;
  a1c_tested: boolean;
  risk: number;
  readmitted_30d: boolean;
  reasons: string[];
};

export type Selection = {
  k: number;
  method: string;
  label: string;
  detail: string;
  recommended?: boolean;
  advisory?: string;
  caught_this_draw: number;
  caught_averaged: number;
  precision_this_draw: number;
  patients: Patient[];
  note: string;
  notices: Notices;
};

export type Curve = {
  kmax: number;
  step: number;
  series: { method: string; label: string; recommended?: boolean; points: { k: number; captured: number }[] }[];
};

export type Evidence = {
  test_encounters: number;
  test_patients: number;
  test_events: number;
  base_rate: number;
  m0: {
    lift200: number;
    ci: [number, number];
    auc_gbm: number;
    auc_gbm_with_diagnosis: number;
    captured200_gbm: number;
    captured200_gbm_with_diagnosis: number;
    captured200_prior_admissions: number;
  };
  amendment: { lift200: number; ci: [number, number] };
  calibration: {
    mean_predicted: number[];
    observed: number[];
    brier: number;
    brier_base_rate_only: number;
  };
  odds_ratios: Record<string, { odds_ratio: number; coef: number }>;
};

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}
