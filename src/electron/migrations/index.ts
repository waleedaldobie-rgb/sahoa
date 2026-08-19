import { Migration } from './types';
import { migration001 } from './001_accessory_purchase_price';
import { migration002 } from './002_order_references';
import { migration003 } from './003_order_events_indexes';
import { migration004 } from './004_order_events_created_at';
import { migration005 } from './005_performance_indexes';
import { migration006 } from './006_list_order_indexes';
import { migration007 } from './007_accessory_selling_price';

export const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007
].sort((a, b) => a.version - b.version);
