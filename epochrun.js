// epochrun.js：按预算回收到期租约并留账（基线：一律给空表）
import { canAcquire, holdsLease } from "./lease.js";

export function step(spec) {
  return { state: spec.state, holders: [], expired: [], reclaimed: [], reclaimed_count: 0,
           epoch: 0, pending_before: 0, pending_ids: [], catchup: 0, judged: 0, judged_bound: 0 };
}

export function close(spec) {
  return { state: spec.state, catchup: 0 };
}
