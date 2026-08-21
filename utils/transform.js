// Sequelize/MySQL uses integer `id` primary keys. The frontend (originally built
// against MongoDB) expects a Mongo-style `_id` field everywhere. Rather than
// rewrite the whole frontend, we transparently add a string `_id` (mirroring
// `id`) to every object/array we send back, recursively.
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
