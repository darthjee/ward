import { IsOptional, Matches } from 'class-validator';

/**
 * Query of `GET <base>/bills.json`: an optional `provider_account_id` filter
 * (a positive integer; an unknown, foreign or non-provider id answers an
 * empty list, never 404). A repeated or malformed value answers 400; unknown
 * parameters are stripped (`page` is read raw by the controller).
 */
export class ListBillsQueryDto {
  @IsOptional()
  @Matches(/^[1-9][0-9]{0,9}$/)
    provider_account_id?: string;
}
