// Sequelize/MySQL uses integer `id` primary keys. The frontend (originally built
// against MongoDB) expects a Mongo-style `_id` field everywhere. Rather than
// rewrite the whole frontend, we transparently add a string `_id` (mirroring
// `id`) to every object/array we send back, recursively.

// Prisma's @map on an enum VALUE only changes the underlying DB string - the
// Prisma Client API still speaks the un-mapped identifier (e.g. "MoMoPay").
// The rest of the app (and every client) speaks the original display string
// ("MoMo Pay"), so translate back here, in the one place all outgoing JSON
// already passes through.
const PAYMENT_METHOD_DISPLAY = { Cash: 'Cash', MoMoPay: 'MoMo Pay', MoMoCode: 'MoMo Code' }

const toClientJSON = (data) => {
    if (data === null || data === undefined) return data
    const plain = JSON.parse(JSON.stringify(data))

    const walk = (node) => {
        if (Array.isArray(node)) return node.map(walk)
        if (node && typeof node === 'object') {
            for (const key of Object.keys(node)) {
                node[key] = walk(node[key])
            }
            if (node.id !== undefined && node._id === undefined) {
                node._id = String(node.id)
            }
            if (node.paymentMethod !== undefined && PAYMENT_METHOD_DISPLAY[node.paymentMethod]) {
                node.paymentMethod = PAYMENT_METHOD_DISPLAY[node.paymentMethod]
            }
            // Orders used to store a nested Mongo `paymentIntent` object; MySQL
            // stores it as flat columns. Reconstruct the nested shape the
            // frontend expects, without needing any frontend changes.
            if (node.paymentIntentId !== undefined && node.paymentIntent === undefined) {
                node.paymentIntent = {
                    id: node.paymentIntentId,
                    amount: node.paymentAmount,
                    currency: node.paymentCurrency,
                    status: node.paymentStatus,
                    method: node.paymentMethod,
                }
            }
            return node
        }
        return node
    }
    return walk(plain)
}

module.exports = { toClientJSON }
