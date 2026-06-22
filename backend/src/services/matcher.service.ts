// =============================================================================
// Hybrid AI Matching Engine — Pure Local Computation
// =============================================================================
// Zero external API calls. Zero LLM tokens. Runs in-process on pre-parsed
// structured data (skills arrays, CGPA, experience) that already live in
// our MongoDB records.
//
// Algorithm breakdown:
//   30% — Hard Filters  (CGPA: 15%, Experience: 15%)
//   70% — Jaccard Skill Similarity
//
// Output: integer 0–100 (match percentage)
// =============================================================================

// =============================================================================
// Input Contracts
// =============================================================================
export interface StudentMatchInput {
  parsedSkills: string[];
  cgpa: number;
  experienceYears: number;
}

export interface JobMatchInput {
  requiredSkills: string[];
  minCgpa: number;
  minExperience: number;
}

// =============================================================================
// Scoring Weights — must sum to exactly 1.0
// =============================================================================
const WEIGHTS = {
  CGPA:       0.15, // Binary hard filter — pass/fail
  EXPERIENCE: 0.15, // Proportional soft filter — capped at 1.0
  SKILLS:     0.70, // Jaccard similarity — continuous 0→1
} as const;

// Minimum score (0–100) a student must reach to be eligible to apply.
// Exported so the controller and any future UI config can reference it.
export const APPLY_THRESHOLD = 50;

// =============================================================================
// calculateMatchScore
// =============================================================================
// Pure function — no I/O, no side effects, deterministic.
// Safe to call in a tight loop for the getStudentMatches endpoint
// (one call per job in the active listing, ~µs per evaluation).
// =============================================================================
export function calculateMatchScore(
  student: StudentMatchInput,
  job: JobMatchInput,
): number {

  // ── 1. CGPA Score (0 or 1, binary) ──────────────────────────────────────
  // Binary because universities grade at different scales — a partial
  // credit model rewards gaming (rounding up). Binary is honest.
  // Edge case: minCgpa === 0 means no CGPA requirement → full credit.
  const cgpaScore =
    job.minCgpa === 0 || student.cgpa >= job.minCgpa ? 1.0 : 0.0;

  // ── 2. Experience Score (0→1, proportional, capped at 1.0) ──────────────
  // Proportional rather than binary because 1.8 years vs 2.0 years required
  // should score better than 0.5 years. Capped at 1.0 — extra experience
  // doesn't inflate the score beyond its allotted weight.
  // Edge case: minExperience === 0 → no requirement → full credit.
  const expScore =
    job.minExperience === 0
      ? 1.0
      : Math.min(student.experienceYears / job.minExperience, 1.0);

  // ── 3. Jaccard Skill Similarity (0→1, continuous) ───────────────────────
  // Jaccard Index = |Intersection| / |Union|
  //
  // Why Jaccard over cosine similarity?
  //   - Our skill vectors are boolean sets (a skill is present or absent),
  //     not weighted frequency vectors. Jaccard is designed for set data.
  //   - No embedding model needed → zero API calls, zero latency overhead.
  //   - Naturally penalises both false positives AND false negatives.
  //
  // Normalisation: lowercase + trim applied to both sides so "React",
  // "react", "react " all resolve to "react" — matching is skill-identity
  // based, not string-literal based.
  const studentSkillSet = new Set(
    student.parsedSkills
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length > 0),  // Remove empty strings post-trim
  );

  const jobSkillSet = new Set(
    job.requiredSkills
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length > 0),
  );

  let jaccardScore: number;

  if (jobSkillSet.size === 0) {
    // No specific skills required → anyone qualifies for the skill component.
    // A job with no skill requirements should not penalise students.
    jaccardScore = 1.0;
  } else if (studentSkillSet.size === 0) {
    // Student has no parsed skills yet (resume not uploaded/parsed).
    // Cannot grant any skill credit.
    jaccardScore = 0.0;
  } else {
    // Count skills present in both sets
    const intersectionSize = [...studentSkillSet].filter((s) =>
      jobSkillSet.has(s),
    ).length;

    // We shouldn't penalize students for having MORE skills than required.
    // Instead of Jaccard (Intersection / Union), we use Recall (Intersection / Required).
    jaccardScore = intersectionSize / jobSkillSet.size;
  }

  // ── 4. Weighted Total ────────────────────────────────────────────────────
  const rawScore =
    cgpaScore   * WEIGHTS.CGPA       +   // 0–0.15
    expScore    * WEIGHTS.EXPERIENCE  +   // 0–0.15
    jaccardScore * WEIGHTS.SKILLS;        // 0–0.70

  // Clamp and round to nearest integer percentage (0–100)
  return Math.round(Math.min(Math.max(rawScore, 0), 1) * 100);
}
