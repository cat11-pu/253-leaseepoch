// epochrun.js：按预算回收到期租约并留账
import { canAcquire, holdsLease } from "./lease.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codes(spec) {
  return {
    held: (spec && spec.held_error_code) || "E_LEASE_HELD",
    none: (spec && spec.none_error_code) || "E_NO_LEASE",
    event: (spec && spec.event_error_code) || "E_BAD_EVENT"
  };
}

// 不改动入参里的 state：同一批事件会被不同预算、不同拆法反复跑。
function cloneState(state) {
  const src = state || {};
  return {
    epoch: src.epoch || 0,
    active: Object.assign({}, src.active),
    expired: (src.expired || []).map((entry) => Object.assign({}, entry)),
    reclaimed: (src.reclaimed || []).slice(),
    applied: (src.applied || []).slice()
  };
}

function checkEvent(event, code) {
  if (!event || typeof event !== "object") fail(code, "event is not an object");
  if (!Number.isFinite(event.id)) fail(code, "event id is not a number");
  if (event.holder === undefined || event.holder === null) fail(code, "event holder is missing");
  if (event.kind === "acquire") {
    if (!Number.isFinite(event.ttl)) fail(code, "acquire ttl is not a number");
  } else if (event.kind !== "release") {
    fail(code, "unknown event kind");
  }
}

export function step(spec) {
  const opts = spec || {};
  const code = codes(opts);
  const state = cloneState(opts.state);
  const events = opts.events || [];
  let budget = Math.max(0, opts.budget || 0);
  let judged = 0;
  let reclaimedNow = 0;
  for (const event of events) {
    checkEvent(event, code.event);
    if (state.applied.indexOf(event.id) !== -1) continue;
    if (event.kind === "acquire") {
      if (!canAcquire(state, event.holder)) fail(code.held, "holder already holds a lease");
      state.active[event.holder] = event.ttl;
      state.epoch += 1;
    } else {
      if (!holdsLease(state, event.holder)) fail(code.none, "holder holds no lease");
      delete state.active[event.holder];
      state.expired.push({ id: event.id, holder: event.holder });
    }
    state.applied.push(event.id);
    judged += 1;
    while (budget > 0 && state.expired.length > 0) {
      const next = state.expired.shift();
      state.reclaimed.push(next.holder);
      budget -= 1;
      reclaimedNow += 1;
    }
  }
  return {
    state: state,
    holders: Object.keys(state.active).sort(),
    expired: state.expired.map((entry) => entry.holder),
    reclaimed: state.reclaimed.slice(),
    reclaimed_count: reclaimedNow,
    epoch: state.epoch,
    pending_before: state.expired.length,
    pending_ids: state.expired.map((entry) => entry.id),
    catchup: 0,
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const opts = spec || {};
  const state = cloneState(opts.state);
  let catchup = 0;
  while (state.expired.length > 0) {
    const next = state.expired.shift();
    state.reclaimed.push(next.holder);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
