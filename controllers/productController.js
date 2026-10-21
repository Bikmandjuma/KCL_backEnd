const asyncHandler = require('express-async-handler')
const slugify = require('slugify')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { encodeId, decodeId } = require('../utils/idHash')
const { toNumber, toBool } = require('../utils/coerce')

const withHash = (product) => ({ ...product, hash: encodeId(product.id) })

//Get all Products - All Users can access (storefront only sees active ones)
//Supports ?search=&category=&page=&limit=&new=true&all=true (staff only)
getProducts = asyncHandler(async(req,res)=>{
    const qNew = req.query.new
    const qCategory = req.query.category
    const qSearch = req.query.search
    const qAll = req.query.all // admin/manager can request inactive products too

    const where = {}
    if (!qAll) where.active = true
    if (qCategory) where.categories = qCategory
    if (qSearch) where.title = { contains: qSearch }

    if (qNew){
        const products = await prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, take: 8 })
        return res.status(200).json(toClientJSON(products.map(withHash)))
    }

    const { page, limit, offset } = getPagination(req.query, 12)
    const [rows, count] = await Promise.all([
        prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        prisma.product.count({ where }),
    ])
    const paged = buildPageResult({ rows, count }, page, limit)
    paged.items = paged.items.map(withHash)
    res.status(200).json(toClientJSON(paged))
})

//Get one Product by its public hash (falls back to raw numeric id for internal/admin use)
getProduct = asyncHandler(async(req,res)=>{
    const raw = req.params.id
    const id = /^\d+$/.test(raw) ? Number(raw) : decodeId(raw)
    if (!id){ res.status(400); throw new Error('Invalid product reference') }

    const product = await prisma.product.findUnique({
        where: { id },
        include: { ratings: { include: { postedby: { select: { id: true, username: true } } } } },
    })
    if (!product){
        res.status(400)
        throw new Error('No Product Available')
    }
    res.status(200).json(toClientJSON(withHash(product)))
})

//Get distinct categories (machine types)
getCategories = asyncHandler(async(req,res)=>{
    const rows = await prisma.product.findMany({
        distinct: ['categories'],
        select: { categories: true },
    })
    res.status(200).json(rows.map((r) => r.categories))
})

//Create a Product - Only Admin / permitted Manager
createProduct = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const body = req.body
    if (!body.title || !body.price){
        res.status(400)
        throw new Error('Title and price are mandatory')
    }
    const slug = slugify(body.title + '-' + Date.now(), { lower: true })

    const files = req.files || {}
    const image = files.image?.[0] ? `/uploads/products/${files.image[0].filename}` : body.image
    const gallery = files.gallery?.length ? files.gallery.map((f) => `/uploads/products/${f.filename}`) : []
    if (!image) { res.status(400); throw new Error('An image is required') }

    const product = await prisma.product.create({
        data: {
            title: body.title,
            slug,
            price: toNumber(body.price),
            categories: body.categories,
            brand: body.brand,
            quantity: toNumber(body.quantity) ?? 0,
            color: body.color,
            image,
            gallery,
            desc: body.desc,
            size: body.size,
            featured: toBool(body.featured) ?? false,
            active: body.active !== undefined ? toBool(body.active) : true,
            listedById: userId,
        },
    })
    res.status(201).json(toClientJSON(withHash(product)))
})

//Update a Product - Only Admin / permitted Manager
updateProduct = asyncHandler(async(req,res)=>{
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } })
    if (!product){
        res.status(400)
        throw new Error('No Product Available')
    }
    const body = req.body
    const data = {}
    if (body.title !== undefined) {
        data.title = body.title
        data.slug = slugify(body.title + '-' + product.id, { lower: true })
    }
    if (body.price !== undefined) data.price = toNumber(body.price)
    if (body.categories !== undefined) data.categories = body.categories
    if (body.brand !== undefined) data.brand = body.brand
    if (body.quantity !== undefined) data.quantity = toNumber(body.quantity)
    if (body.color !== undefined) data.color = body.color
    if (body.desc !== undefined) data.desc = body.desc
    if (body.size !== undefined) data.size = body.size
    if (body.featured !== undefined) data.featured = toBool(body.featured)
    if (body.active !== undefined) data.active = toBool(body.active)

    const files = req.files || {}
    if (files.image?.[0]) data.image = `/uploads/products/${files.image[0].filename}`
    if (files.gallery?.length) data.gallery = files.gallery.map((f) => `/uploads/products/${f.filename}`)

    const updated = await prisma.product.update({ where: { id: product.id }, data })
    res.status(200).json(toClientJSON(withHash(updated)))
})

//Delete a Product - Only Admin / permitted Manager
deleteProduct = asyncHandler(async(req,res)=>{
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } })
    if (!product){
        res.status(400)
        throw new Error('No Product Available')
    }
    await prisma.product.delete({ where: { id: product.id } })
    res.status(200).json(toClientJSON(product))
})

addToWishlist = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const productId = Number(req.body.productId)
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('No such User found')

    const existing = await prisma.wishlist.findUnique({
        where: { userId_productId: { userId, productId } },
    })
    if (existing){
        await prisma.wishlist.delete({ where: { userId_productId: { userId, productId } } })
    } else {
        await prisma.wishlist.create({ data: { userId, productId } })
    }
    const wishlistItems = await prisma.wishlist.findMany({ where: { userId }, include: { product: true } })
    res.json(toClientJSON({
        id: user.id, username: user.username, email: user.email,
        wishlist: wishlistItems.map((w) => w.product),
    }))
})

rating = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const { star, productId, comments } = req.body
    const pid = Number(productId)
    const product = await prisma.product.findUnique({ where: { id: pid } })
    if (!product) throw new Error('No such product found')

    const existing = await prisma.rating.findFirst({ where: { productId: pid, userId } })
    if (existing){
        await prisma.rating.update({ where: { id: existing.id }, data: { star: Number(star), comments } })
    } else {
        await prisma.rating.create({ data: { star: Number(star), comments, productId: pid, userId } })
    }

    const allRatings = await prisma.rating.findMany({ where: { productId: pid } })
    const totalRatings = allRatings.length
    const ratingSum = allRatings.reduce((a, r) => a + r.star, 0)
    const actualRating = totalRatings ? Math.round(ratingSum / totalRatings) : 0

    await prisma.product.update({ where: { id: pid }, data: { totalRatings: actualRating } })
    const productWithRatings = await prisma.product.findUnique({ where: { id: pid }, include: { ratings: true } })
    res.json(toClientJSON(productWithRatings))
})

// Public search across products (used by the navbar search modal). Returns a
// small, fast result set: title, category, price, image, and its hash link.
searchProducts = asyncHandler(async(req,res)=>{
    const q = (req.query.q || '').trim()
    if (!q){ return res.status(200).json([]) }
    const products = await prisma.product.findMany({
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
    })
    res.status(200).json(toClientJSON(products.map(withHash)))
})

module.exports = { getProducts, getProduct, getCategories, createProduct, updateProduct, deleteProduct, addToWishlist, rating, searchProducts }
