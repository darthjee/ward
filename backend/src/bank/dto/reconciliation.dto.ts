import { ArrayMaxSize, IsArray, IsInt, IsString, Max, Min } from 'class-validator';
import { IsLedgerDate, IsOptionalNonNull } from './field-validators.js';
import { MAX_ID } from '../../core/parse-id.js';

/** Most transaction ids one ticks request accepts per array (`tick` and `untick`), counted raw. */
export const RECONCILIATION_TICK_MAX_IDS = 50;

/**
 * Request body of `POST <base>/accounts/:accountId/reconciliations.json`, taken through
 * `@StrictBody()` (any other field, e.g. `account_id`, `status` or `reconciled_at`, answers 400).
 * `statement_balance` is parsed against the account currency by the service.
 */
export class CreateReconciliationDto {
  @IsLedgerDate()
    statement_date!: string;

  @IsString()
    statement_balance!: string;
}

/**
 * Request body of `PATCH <base>/accounts/:accountId/reconciliations/:id.json`: the fields of
 * {@link CreateReconciliationDto}, each optional. Taken through `@StrictBody()`.
 */
export class UpdateReconciliationDto {
  @IsOptionalNonNull()
  @IsLedgerDate()
    statement_date?: string;

  @IsOptionalNonNull()
  @IsString()
    statement_balance?: string;
}

/**
 * Request body of `POST <base>/accounts/:accountId/reconciliations/:id/ticks.json`, taken
 * through `@StrictBody()`: up to {@link RECONCILIATION_TICK_MAX_IDS} positive integer ids per
 * array (raw length), each array optional and defaulting to `[]`. Emptiness and overlap are
 * checked by `normalizeTicks`.
 */
export class ReconciliationTicksDto {
  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(RECONCILIATION_TICK_MAX_IDS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_ID, { each: true })
    tick: number[] = [];

  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(RECONCILIATION_TICK_MAX_IDS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_ID, { each: true })
    untick: number[] = [];
}

/**
 * Request body of finish and undo (`{}`), taken through `@StrictBody()`: it declares no field,
 * so any field answers 400.
 */
export class EmptyReconciliationBodyDto {}
