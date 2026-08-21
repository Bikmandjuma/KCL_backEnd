const asyncHandler = require('express-async-handler')
const { Op, fn, col } = require('sequelize')
const slugify = require('slugify')
const { Product, Rating, User } = require('../models')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { encodeId, decodeId } = require('../utils/idHash')

const withHash = (product) => {
    const plain = product.get ? product.get({ plain: true }) : product
    return { ...plain, hash: encodeId(plain.id) }
}

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
    if (qSearch) where.title = { [Op.like]: `%${qSearch}%` }

    if (qNew){
        const products = await Product.findAll({ where, order: [['createdAt', 'DESC']], limit: 8 })
        return res.status(200).json(toClientJSON(products.map(withHash)))
    }

    const { page, limit, offset } = getPagination(req.query, 12)
    const result = await Product.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset })
    const paged = buildPageResult(result, page, limit)
    paged.items = paged.items.map(withHash)
    res.status(200).json(toClientJSON(paged))
})

//Get one Product by its public hash (falls back to raw numeric id for internal/admin use)
getProduct = asyncHandler(async(req,res)=>{
    const raw = req.params.id
    const id = /^\d+$/.test(raw) ? Number(raw) : decodeId(raw)
    if (!id){ res.status(400); throw new Error('Invalid product reference') }

    const product = await Product.findByPk(id, {
        include: [{ model: Rating, as: 'ratings', include: [{ model: User, as: 'postedby', attributes: ['id', 'username'] }] }]
    })
    if (!product){
        res.status(400)
        throw new Error('No Product Available')
    }
    res.status(200).json(toClientJSON(withHash(product)))
})

//Get distinct categories (machine types)
getCategories = asyncHandler(async(req,res)=>{
    const rows = await Product.findAll({
        attributes: [[fn('DISTINCT', col('categories')), 'categories']],
        raw: true,
    })
    res.status(200).json(rows.map((r) => r.categories))
})

//Create a Product - Only Admin / permitted Manager
createProduct = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const body = { ...req.body }
    if (!body.title || !body.price){
        res.status(400)
        throw new Error('Title and price are mandatory')
    }
    body.slug = slugify(body.title + '-' + Date.now(), { lower: true })

    const files = req.files || {}
    if (files.image?.[0]) body.image = `/uploads/products/${files.image[0].filename}`
    if (files.gallery?.length) body.gallery = files.gallery.map((f) => `/uploads/products/${f.filename}`)

    const product = await Product.create({ ...body, listedById: userId })
    res.status(201).json(toClientJSON(withHash(product)))
})

//Update a Product - Only Admin / permitted Manager
updateProduct = asyncHandler(async(req,res)=>{
    const product = await Product.findByPk(req.params.id)
    if (!product){
        res.status(400)
        throw new Error('No Product Available')
    }
    const body = { ...req.body }
    if (body.title) body.slug = slugify(body.title + '-' + req.params.id, { lower: true })

    const files = req.files || {}
    if (files.image?.[0]) body.image = `/uploads/products/${files.image[0].filename}`
    if (files.gallery?.length) body.gallery = files.gallery.map((f) => `/uploads/products/${f.filename}`)

    await product.update(body)
    res.status(200).json(toClientJSON(withHash(product)))
})

//Delete a Product - Only Admin / permitted Manager
deleteProduct = asyncHandler(async(req,res)=>{
    const product = await Product.findByPk(req.params.id)
    if (!product){
        res.status(400)
        throw new Error('No Product Available')
    }
    await product.destroy()
    res.status(200).json(toClientJSON(product))
})

addToWishlist = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const { productId } = req.body
    const user = await User.findByPk(userId)
    if (!user) throw new Error('No such User found')

    const alreadyAdded = await user.hasWishlist(productId)
    if (alreadyAdded){
        await user.removeWishlist(productId)
    } else {
        await user.addWishlist(productId)
    }
    const updated = await User.findByPk(userId, { include: [{ model: Product, as: 'wishlist' }] })
    res.json(toClientJSON(updated))
})

rating = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const { star, productId, comments } = req.body
    const product = await Product.findByPk(productId)
    if (!product) throw new Error('No such product found')

    const existing = await Rating.findOne({ where: { productId, userId } })
    if (existing){
        await existing.update({ star, comments })
    } else {
        await Rating.create({ star, comments, productId, userId })
    }

    const allRatings = await Rating.findAll({ where: { productId } })
    const totalRatings = allRatings.length
    const ratingSum = allRatings.reduce((a, r) => a + r.star, 0)
    const actualRating = totalRatings ? Math.round(ratingSum / totalRatings) : 0

    await product.update({ totalRatings: actualRating })
    const productWithRatings = await Product.findByPk(productId, { include: [{ model: Rating, as: 'ratings' }] })
    res.json(toClientJSON(productWithRatings))
})

// Public search across products (used by the navbar search modal). Returns a
// small, fast result set: title, category, price, image, and its hash link.
searchProducts = asyncHandler(async(req,res)=>{
    const q = (req.query.q || '').trim()
    if (!q){ return res.status(200).json([]) }
    const products = await Product.findAll({
        where: {
            active: true,
            [Op.or]: [
                { title: { [Op.like]: `%${q}%` } },
                { categories: { [Op.like]: `%${q}%` } },
                { brand: { [Op.like]: `%${q}%` } },
                { desc: { [Op.like]: `%${q}%` } },
            ],
        },
        limit: 10,
        order: [['createdAt', 'DESC']],
    })
    res.status(200).json(toClientJSON(products.map(withHash)))
})

module.exports = { getProducts, getProduct, getCategories, createProduct, updateProduct, deleteProduct, addToWishlist, rating, searchProducts }
