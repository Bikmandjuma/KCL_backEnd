const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')

const startOf = (range) => {
    const now = new Date()
    const d = new Date(now)
    if (range === 'daily') { d.setHours(0,0,0,0); return d }
    if (range === 'weekly') { const day = d.getDay(); d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d }
    if (range === 'monthly') { d.setDate(1); d.setHours(0,0,0,0); return d }
    if (range === 'yearly') { d.setMonth(0,1); d.setHours(0,0,0,0); return d }
    return new Date(0) // lifetime
}

const rangeStats = async (model, extraWhere = {}) => {
    const ranges = ['daily','weekly','monthly','yearly','lifetime']
    const out = {}
    for (const r of ranges){
        out[r] = await model.count({ where: { ...extraWhere, createdAt: { gte: startOf(r) } } })
    }
    return out
}

// Admin / permitted Manager dashboard summary
getDashboardStats = asyncHandler(async (req, res) => {
    const visits = await rangeStats(prisma.visit)
    const orders = await rangeStats(prisma.order)
    const cancelled = await rangeStats(prisma.order, { orderStatus: 'Cancelled' })
    const delivered = await rangeStats(prisma.order, { orderStatus: 'Delivered' })

    const totalUsers = await prisma.user.count({ where: { role: 'guest' } })
    const totalProducts = await prisma.product.count()
    const totalDrinksOrders = await prisma.order.count()

    const revenueAgg = await prisma.order.aggregate({
        _sum: { paymentAmount: true },
        where: { orderStatus: { not: 'Cancelled' } },
    })
    const totalRevenue = revenueAgg._sum.paymentAmount || 0

    // last 14 days order trend, for charting
    const since = new Date(); since.setDate(since.getDate() - 13); since.setHours(0,0,0,0)
    const recentOrders = await prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
    })
    const trendMap = {}
    for (const o of recentOrders) {
        const day = o.createdAt.toISOString().slice(0, 10)
        trendMap[day] = (trendMap[day] || 0) + 1
    }
    const trend = Object.entries(trendMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ _id: date, count }))

    const topProducts = await prisma.product.findMany({
        orderBy: { sold: 'desc' },
        take: 5,
        select: { id: true, title: true, sold: true, price: true, image: true },
    })

    res.status(200).json({
        visits, orders, cancelled, delivered,
        totalUsers, totalProducts, totalRevenue, totalDrinksOrders,
        trend,
        topProducts: topProducts.map((p) => ({ ...p, _id: String(p.id) })),
    })
})

// Lightweight per-resource counts for the admin sidebar's little number
// badges (e.g. "Orders 12"). Any staff account can call this - it's just
// counts, and which of these the frontend actually shows is already gated
// per-item by that staff member's own permissions.
getNavCounts = asyncHandler(async (req, res) => {
    const [products, drinks, orders, tables, bookings, trainingSessions, trainingApplications, historyStories, users] = await Promise.all([
        prisma.product.count(),
        prisma.drink.count(),
        prisma.order.count(),
        prisma.table.count(),
        prisma.tableBooking.count({ where: { status: { in: ['Upcoming', 'Active'] } } }),
        prisma.trainingSession.count(),
        prisma.trainingApplication.count({ where: { status: 'Pending' } }),
        prisma.staffStory.count(),
        prisma.user.count(),
    ])
    res.status(200).json({
        products, drinks, orders, tables, bookings,
        trainingSessions, trainingApplications, historyStories, users,
    })
})

module.exports = { getDashboardStats, getNavCounts }
