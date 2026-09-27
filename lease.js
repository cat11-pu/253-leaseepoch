// lease.js：能不能申请、有没有租约（空状态也合法）
function activeTable(state) {
  return (state && state.active) || {};
}

export function canAcquire(state, holder) {
  return !Object.prototype.hasOwnProperty.call(activeTable(state), holder);
}

export function holdsLease(state, holder) {
  return Object.prototype.hasOwnProperty.call(activeTable(state), holder);
}
