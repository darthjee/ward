import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, Max, Min } from 'class-validator';
import { MAX_ID } from '../../core/parse-id.js';

/** Most transaction ids one mark request accepts. */
export const MARK_MAX_IDS = 1000;

/**
 * Request body of `POST <base>/accountant/mark-sent.json` and
 * `mark-unsent.json`, taken through `@StrictBody()` (any other field answers
 * 400): 1 to {@link MARK_MAX_IDS} positive integer transaction ids. An entry
 * that is not a positive integer answers 400 (not 404); duplicates are
 * accepted and de-duplicated by the service.
 */
export class MarkChargesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MARK_MAX_IDS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_ID, { each: true })
    transaction_ids!: number[];
}
