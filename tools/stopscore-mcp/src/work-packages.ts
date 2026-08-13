import { z } from "zod";

const repositoryPath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.split(/[\\/]/).includes("..") &&
      !value.includes("\0"),
    "Files must use safe repository-relative paths.",
  );

const workPackageInput = z.object({
  gapId: z.string().min(3).max(100),
  goal: z.string().min(10).max(500),
  allowedFiles: z.array(repositoryPath).min(1).max(20),
  acceptanceCriteria: z.array(z.string().min(5).max(500)).min(1).max(20),
});

export type WorkPackageInput = z.infer<typeof workPackageInput>;

const forbiddenScope = [
  /route optim/i,
  /in[- ]app map/i,
  /invent(?:ed)? gps/i,
  /pickup truck/i,
  /automatic production publish/i,
];

export function createWorkPackage(input: WorkPackageInput) {
  const parsed = workPackageInput.parse(input);
  const searchable = [
    parsed.gapId,
    parsed.goal,
    ...parsed.acceptanceCriteria,
  ].join(" ");

  if (forbiddenScope.some((pattern) => pattern.test(searchable))) {
    throw new Error("This request is outside the approved StopScore scope.");
  }

  return {
    id: parsed.gapId,
    scope: "minimum-change" as const,
    goal: parsed.goal,
    allowedFiles: [...new Set(parsed.allowedFiles)],
    acceptanceCriteria: parsed.acceptanceCriteria,
    protectedRequirements: [
      "Preserve saved data and active workday state.",
      "Do not redesign unrelated screens.",
      "Keep production publication behind exact-version confirmation.",
    ],
    finalVerification: [
      "npm run lint",
      "npm test",
      "npm run validate:artifact",
    ],
  };
}

