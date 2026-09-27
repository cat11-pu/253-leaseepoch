// epochrun.js：按世代发放/回收租约，整批共用回收预算，用尽压账带出下一轮
import { canAcquire, holdsLease } from "./lease.js";

const HELD = "E_LEASE_HELD";
const NONE = "E_NO_LEASE";
const BAD = "E_BAD_EVENT";

function error(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function cloneState(source) {
  const src = source || {};
  return {
    epoch: Number(src.epoch) || 0,
    active: Object.assign({}, src.active || {}),
    expired: Array.isArray(src.expired) ? src.expired.slice() : [],
    reclaimed: Array.isArray(src.reclaimed) ? src.reclaimed.slice() : [],
    applied: Array.isArray(src.applied) ? src.applied.slice() : []
  };
}

function validEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(event, "id")) return false;
  if (typeof event.holder === "undefined" || event.holder === null) return false;
  if (event.kind !== "acquire" && event.kind !== "release") return false;
  if (event.kind === "acquire") {
    if (typeof event.ttl !== "number" || !Number.isFinite(event.ttl) || event.ttl <= 0) return false;
  }
  return true;
}

// 按预算从待回收集合队首回收；返回本轮实际回收条数
function drain(state, remaining) {
  let taken = 0;
  while (remaining > 0 && state.expired.length > 0) {
    state.reclaimed.push(state.expired.shift());
    taken += 1;
    remaining -= 1;
  }
  return taken;
}

export function step(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  let budget = Number(spec.budget);
  if (!Number.isFinite(budget) || budget < 0) budget = 0;

  const reclaimedBefore = state.reclaimed.length;

  let judged = 0;

  for (const event of events) {
    if (!validEvent(event)) throw error(BAD, "bad event");
    // 跨轮已处理（含重放）的事件直接跳过，不再产生任何效果
    if (state.applied.indexOf(event.id) !== -1) continue;

    judged += 1;
    if (event.kind === "acquire") {
      if (!canAcquire(state, event.holder)) throw error(HELD, "lease already held");
      state.epoch += 1;
      state.active[event.holder] = state.epoch;
    } else {
      if (!holdsLease(state, event.holder)) throw error(NONE, "no active lease");
      state.expired.push(state.active[event.holder]);
      delete state.active[event.holder];
    }
    state.applied.push(event.id);

    // 每次事件后按整批共用预算回收，用尽后剩下的压在账上
    const taken = drain(state, budget);
    budget -= taken;
  }

  return {
    state,
    holders: Object.keys(state.active).sort(),
    expired: state.expired.slice(),
    reclaimed: state.reclaimed.slice(),
    reclaimed_count: state.reclaimed.length - reclaimedBefore,
    epoch: state.epoch,
    pending_before: state.expired.length,
    pending_ids: state.expired.slice(),
    catchup: 0,
    judged,
    judged_bound: events.length
  };
}

// 收尾：不限预算把待回收集合全部回收，返回补齐条数
export function close(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  const catchup = drain(state, Number.POSITIVE_INFINITY);
  return { state, catchup };
}
