import { createHash } from 'node:crypto';

/** Parses durations like `15m`, `7d`, `90s` into milliseconds. */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const multiplier = multipliers[unit];
  if (multiplier === undefined) throw new Error(`Invalid duration: ${value}`);
  return amount * multiplier;
}

/** SHA-256 hex digest used to store refresh tokens at rest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
