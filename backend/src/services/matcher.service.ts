/**
 * Hybrid AI Matching Engine — Pure Local Computation.
 * Evaluates candidates against job requirements using a weighted algorithmic scoring model.
 */

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

/**
 * Calculates a match score between a candidate's profile and a job's requirements.
 *
 * @param {StudentMatchInput} student - The parsed profile metrics of the candidate.
 * @param {JobMatchInput} job - The structured hiring requirements.
 * @returns {number} An integer representing the match percentage (0–100).
 *
 * @architecture
 * O(1) Algorithmic Efficiency: Executes in-process using pre-parsed DB payloads. No I/O 
 * or side effects, making it deterministic and safe for high-frequency tight-loop execution.
 */
export function calculateMatchScore(
  student: StudentMatchInput,
  job: JobMatchInput,
): number {

  // ── 1. CGPA Score (0 or 1, binary) ──────────────────────────────────────
  const cgpaScore =
    job.minCgpa === 0 || student.cgpa >= job.minCgpa ? 1.0 : 0.0;

  // ── 2. Experience Score (0→1, proportional, capped at 1.0) ──────────────
  const expScore =
    job.minExperience === 0
      ? 1.0
      : Math.min(student.experienceYears / job.minExperience, 1.0);

  // ── 3. Jaccard Skill Similarity (0→1, continuous) ───────────────────────
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
