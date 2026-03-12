import { emailToColor } from '../../lib/utils';
import type { Account } from '../../types';

export function getAccountColor(account: Account | undefined): string {
  if (!account) return '#6B7280';
  return account.color || emailToColor(account.email);
}
