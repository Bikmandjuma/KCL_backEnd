const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { encodeId } = require('../utils/idHash')

// Public - one search box, everything in the database. Used by the top-nav
// search on both the web app and the mobile app so a customer can find a
// coffee, a food item, or a machine without knowing which category it's in.
searchAll = asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim()
    if (!q) return res.status(200).json([])

    const [products, drinks] = await Promise.all([
        prisma.product.findMany({
            where: {
                active: true,
                OR: [
                    { title: { contains: q } },
                    { categories: { contains: q } },
                    { brand: { contains: q } },
                    { desc: { contains: q } },
                ],
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.drink.findMany({
            where: {
                available: true,
                OR: [
                    { name: { contains: q } },
                    { category: { contains: q } },
                    { desc: { contains: q } },
                ],
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
        }),
    ])

    const results = [
        ...products.map((p) => ({
            itemType: 'machine',
            id: p.id,
            hash: encodeId(p.id),
            name: p.title,
            price: p.price,
            image: p.image,
            category: p.categories,
        })),
        ...drinks.map((d) => ({
            itemType: 'menu',
            id: d.id,
            name: d.name,
            price: d.price,
            image: d.image,
            category: d.category,
            menuType: d.type,
        })),
    ]

    res.status(200).json(toClientJSON(results))
})

module.exports = { searchAll }
