import { IsOptional, IsString } from 'class-validator';

/**
 * Query of `GET <base>/accounts/:accountId/provider-bills.json`: an optional
 * `kind` filter (a free string: an unknown value answers an empty list).
 * `page` is read raw by the controller (`parsePage`).
 */
export class ListProviderBillsQueryDto {
  @IsOptional()
  @IsString()
    kind?: string;
}
