import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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

const changeInput = z.object({
  idempotencyKey: z.string().min(3).max(160),
  summary: z.string().min(5).max(1000),
  files: z.array(repositoryPath).min(1).max(100),
  acceptanceCriteria: z.array(z.string().min(3).max(1000)).min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const verificationInput = z.object({
  idempotencyKey: z.string().min(3).max(160),
  versionId: z.string().min(3).max(200),
  command: z.string().min(2).max(500),
  status: z.enum(["passed", "failed", "blocked"]),
  summary: z.string().min(3).max(2000),
  requiredForRelease: z.boolean(),
});

const releaseConfirmationInput = z.object({
  versionId: z.string().min(3).max(200),
  confirmationText: z.string().min(3).max(500),
});

const changeRecord = changeInput.extend({
  recordedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const verificationRecord = verificationInput.extend({ recordedAt: z.string() });

const projectStatusSchema = z.object({
  schemaVersion: z.literal(1),
  milestone: z.enum(["building", "verifying", "ready-for-owner", "released"]),
  changes: z.array(changeRecord),
  verifications: z.array(verificationRecord),
  blockers: z.array(z.string()),
  releaseReady: z.boolean(),
  reviewHandoff: z
    .object({
      versionId: z.string(),
      url: z.string().url(),
      finishingTouches: z.array(z.string()),
      knownLimitations: z.array(z.string()),
    })
    .nullable(),
  releaseConfirmation: z
    .object({
      versionId: z.string(),
      confirmationText: z.string(),
      confirmedAt: z.string(),
    })
    .nullable(),
});

export type ChangeInput = z.infer<typeof changeInput>;
export type VerificationInput = z.infer<typeof verificationInput>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const emptyStatus = (): ProjectStatus => ({
  schemaVersion: 1,
  milestone: "building",
  changes: [],
  verifications: [],
  blockers: [],
  releaseReady: false,
  reviewHandoff: null,
  releaseConfirmation: null,
});

const secretKey = /(?:authorization|bearer|cookie|credential|password|secret|token)/i;

function redact(value: unknown, key = ""): unknown {
  if (secretKey.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function recompute(status: ProjectStatus): ProjectStatus {
  const required = status.verifications.filter((item) => item.requiredForRelease);
  const failed = required.filter((item) => item.status !== "passed");
  return {
    ...status,
    blockers: failed.map(
      (item) => `${item.command}: ${item.status} — ${item.summary}`,
    ),
    releaseReady: required.length > 0 && failed.length === 0,
  };
}

export class StatusStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<ProjectStatus> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return recompute(projectStatusSchema.parse(JSON.parse(raw)));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return emptyStatus();
      throw error;
    }
  }

  async recordChange(input: ChangeInput): Promise<ProjectStatus> {
    const parsed = changeInput.parse(input);
    const status = await this.read();
    if (status.changes.some((item) => item.idempotencyKey === parsed.idempotencyKey)) {
      return status;
    }
    const next = recompute({
      ...status,
      changes: [
        ...status.changes,
        {
          ...parsed,
          metadata: parsed.metadata
            ? (redact(parsed.metadata) as Record<string, unknown>)
            : undefined,
          recordedAt: new Date().toISOString(),
        },
      ],
    });
    await this.write(next);
    return next;
  }

  async recordVerification(input: VerificationInput): Promise<ProjectStatus> {
    const parsed = verificationInput.parse(input);
    const status = await this.read();
    if (
      status.verifications.some(
        (item) => item.idempotencyKey === parsed.idempotencyKey,
      )
    ) {
      return status;
    }
    const next = recompute({
      ...status,
      milestone: "verifying",
      verifications: [
        ...status.verifications,
        { ...parsed, recordedAt: new Date().toISOString() },
      ],
    });
    await this.write(next);
    return next;
  }

  async confirmProductionRelease(
    input: z.infer<typeof releaseConfirmationInput>,
  ): Promise<ProjectStatus> {
    const parsed = releaseConfirmationInput.parse(input);
    const status = await this.read();
    const versionEvidence = status.verifications.filter(
      (item) => item.versionId === parsed.versionId && item.requiredForRelease,
    );
    if (
      versionEvidence.length === 0 ||
      versionEvidence.some((item) => item.status !== "passed")
    ) {
      throw new Error(
        "Production release requires passing release evidence for this exact version.",
      );
    }
    const expected = `I confirm ${parsed.versionId} for production`;
    if (parsed.confirmationText.trim() !== expected) {
      throw new Error(
        `Confirmation must name the exact version using: ${expected}`,
      );
    }
    const next = {
      ...status,
      milestone: "released" as const,
      releaseConfirmation: {
        ...parsed,
        confirmationText: expected,
        confirmedAt: new Date().toISOString(),
      },
    };
    await this.write(next);
    return next;
  }

  private async write(status: ProjectStatus): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

