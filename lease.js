// lease.js：能不能申请、有没有租约（空状态也合法）
export function canAcquire(state, holder) {
  return !((state && state.active) || {})[holder];
}

export function holdsLease(state, holder) {
  return !!((state && state.active) || {})[holder];
}
