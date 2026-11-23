import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../core/error-codes.js';
import type { ReconciliationTicksDto } from './dto/reconciliation.dto.js';

/** The de-duplicated ids of a ticks request. */
export interface NormalizedTicks {
  tick: number[];
  untick: number[];
}

/**
 * Builds a fixed-message 400 (never echoes the submitted ids).
 * @param {string} message - The client-facing message.
 * @returns {BadRequestException} The exception to throw.
 */
function ticksInvalid(message: string): BadRequestException {
  return new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message });
}

/**
 * Normalizes an already-validated ticks body, before any database access: de-duplicates each
 * array, then rejects an empty request and an id present in both arrays.
 * @param {ReconciliationTicksDto} dto - The validated body.
 * @returns {NormalizedTicks} The de-duplicated `tick` and `untick` ids.
 * @throws {BadRequestException} 400 when both arrays are empty or `tick` and `untick` overlap.
 */
export function normalizeTicks(dto: ReconciliationTicksDto): NormalizedTicks {
  const tick = [...new Set(dto.tick ?? [])];
  const untick = [...new Set(dto.untick ?? [])];

  if (tick.length === 0 && untick.length === 0) {
    throw ticksInvalid('At least one transaction must be ticked or unticked.');
  }

  const unticked = new Set(untick);

  if (tick.some((id) => unticked.has(id))) {
    throw ticksInvalid('A transaction cannot be ticked and unticked in the same request.');
  }

  return { tick, untick };
}
