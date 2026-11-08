import { IsIn, IsOptional, IsString } from 'class-validator';
import { ACCOUNT_TYPE_MAX_LENGTH } from './field-validators.js';
import { MaxCodePoints } from '../../core/string-validators.js';

/**
 * Query of `GET <base>/accounts.json`: `type` (default `regular`; a type
 * without a registered handler answers 400) and `archived` (`true` also lists
 * archived accounts; default `false`). A repeated parameter answers 400.
 */
export class ListAccountsQueryDto {
  @IsOptional()
  @IsString()
  @MaxCodePoints(ACCOUNT_TYPE_MAX_LENGTH)
    type?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
    archived?: 'true' | 'false';
}
