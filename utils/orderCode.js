// The public, shareable order code a guest (no account) holds on to and
// uses to track their order - sequential and zero-padded to 7 digits, e.g.
// the very first order ever placed is "KCL-0000001", the second
// "KCL-0000002", and so on. Derived directly from the order's own
// auto-incrementing database id, so it's guaranteed unique and strictly
// sequential with zero extra bookkeeping (no separate counter table to
// keep in sync, no collision risk).
//
// Not a security token: don't put anything sensitive behind it beyond
// "here's my own order's status".
const codeFromOrderId = (id) => `KCL-${String(id).padStart(7, '0')}`

module.exports = { codeFromOrderId }
