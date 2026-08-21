// Shared pagination helper. Returns { limit, offset, page } from req.query,
// and wraps a Sequelize findAndCountAll result into a consistent shape.
const getPagination = (query, defaultLimit = 12) => {
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.max(1, parseInt(query.limit) || defaultLimit)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

const buildPageResult = ({ rows, count }, page, limit) => ({
    items: rows,
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    limit,
})

module.exports = { getPagination, buildPageResult }
