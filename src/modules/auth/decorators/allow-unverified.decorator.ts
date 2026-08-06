import { SetMetadata } from '@nestjs/common';

export const IS_ALLOW_UNVERIFIED_KEY = 'isAllowUnverified';
export const AllowUnverified = () => SetMetadata(IS_ALLOW_UNVERIFIED_KEY, true);
