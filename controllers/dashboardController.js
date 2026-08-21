const asyncHandler = require('express-async-handler')
const { Op, fn, col, literal } = require('sequelize')
const { Order, Visit, User, Product, sequelize } = require('../models')

const startOf = (range) => {
    const now = new Date()
    const d = new Date(now)
    if (range === 'daily') { d.setHours(0,0,0,0); return d }
    if (range === 'weekly') { const day = d.getDay(); d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d }
    if (range === 'monthly') { d.setDate(1); d.setHours(0,0,0,0); return d }
    if (range === 'yearly') { d.setMonth(0,1); d.setHours(0,0,0,0); return d }
    return new Date(0) // lifetime
}

const rangeStats = async (Model, extraWhere = {}) => {
    const ranges = ['daily','weekly','monthly','yearly','lifetime']
    const out = {}
    for (const r of ranges){
        out[r] = await Model.count({ where: { ...extraWhere, createdAt: { [Op.gte]: startOf(r) } } })
    }
    return out
}

// Admin / permitted Manager dashboard summary
getDashboardStats = asyncHandler(async (req, res) => {
    const visits = await rangeStats(Visit)
    const orders = await rangeStats(Order)
    const cancelled = await rangeStats(Order, { orderStatus: 'Cancelled' })
    const delivered = await rangeStats(Order, { orderStatus: 'Delivered' })

    const totalUsers = await User.count({ where: { role: 'guest' } })
    const totalProducts = await Product.count()
    const totalDrinksOrders = await Order.count()

    const totalRevenue = await Order.sum('paymentAmount', {
        where: { orderStatus: { [Op.ne]: 'Cancelled' } }
    }) || 0

    // last 14 days order trend, for charting
    const since = new Date(); since.setDate(since.getDate() - 13); since.setHours(0,0,0,0)
    const trendRaw = await Order.findAll({
        attributes: [
            [fn('DATE', col('createdAt')), 'date'],
            [fn('COUNT', col('id')), 'count'],
        ],
        where: { createdAt: { [Op.gte]: since } },
        group: [literal('DATE(`createdAt`)')],
        order: [[literal('DATE(`createdAt`)'), 'ASC']],
        raw: true,
    })
    const trend = trendRaw.map((t) => ({ _id: String(t.date), count: Number(t.count) }))

    const topProducts = await Product.findAll({
        order: [['sold', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'sold', 'price', 'image'],
        raw: true,
    })

    res.status(200).json({
        visits, orders, cancelled, delivered,
        totalUsers, totalProducts, totalRevenue, totalDrinksOrders,
        trend,
        topProducts: topProducts.map((p) => ({ ...p, _id: String(p.id) })),
    })
})

module.exports = { getDashboardStats }
