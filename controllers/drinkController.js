const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { toNumber, toBool } = require('../utils/coerce')

// Public - the KCL menu, covering both coffee and food.
// Supports ?type=coffee|food (the app's Coffee/Food tabs), ?category=&search=
// &page=&limit=&all=true (staff only, sees hidden/unavailable items)
getDrinks = asyncHandler(async(req,res)=>{
    const { type, category, all, search, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (!all) where.available = true
    if (type) where.type = type
    if (category) where.category = category
    if (search) where.name = { contains: search }

    // The storefront's simple menu tabs just want a flat array (no paging UI there yet)
    if (!pageQ && !limitQ && !all) {
        const drinks = await prisma.drink.findMany({ where, orderBy: { createdAt: 'desc' } })
        return res.status(200).json(toClientJSON(drinks))
    }

    const { page, limit, offset } = getPagination(req.query, 12)
    const [rows, count] = await Promise.all([
        prisma.drink.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        prisma.drink.count({ where }),
    ])
    res.status(200).json(toClientJSON(buildPageResult({ rows, count }, page, limit)))
})

getDrink = asyncHandler(async(req,res)=>{
    const drink = await prisma.drink.findUnique({ where: { id: Number(req.params.id) } })
    if (!drink){ res.status(404); throw new Error('Drink not found') }
    res.status(200).json(toClientJSON(drink))
})

createDrink = asyncHandler(async(req,res)=>{
    const { name, price, type, category, desc } = req.body
    if (!name || !price){ res.status(400); throw new Error('name and price are mandatory') }
    const data = { name, price: toNumber(price), type, category, desc, listedById: req.user._id }
    if (req.file) data.image = `/uploads/drinks/${req.file.filename}`
    const drink = await prisma.drink.create({ data })
    res.status(201).json(toClientJSON(drink))
})

updateDrink = asyncHandler(async(req,res)=>{
    const drink = await prisma.drink.findUnique({ where: { id: Number(req.params.id) } })
    if (!drink){ res.status(404); throw new Error('Drink not found') }
    const { name, price, type, category, desc, available } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (price !== undefined) data.price = toNumber(price)
    if (type !== undefined) data.type = type
    if (category !== undefined) data.category = category
    if (desc !== undefined) data.desc = desc
    if (available !== undefined) data.available = toBool(available)
    if (req.file) data.image = `/uploads/drinks/${req.file.filename}`
    const updated = await prisma.drink.update({ where: { id: drink.id }, data })
    res.status(200).json(toClientJSON(updated))
})

deleteDrink = asyncHandler(async(req,res)=>{
    const drink = await prisma.drink.findUnique({ where: { id: Number(req.params.id) } })
    if (!drink){ res.status(404); throw new Error('Drink not found') }
    await prisma.drink.delete({ where: { id: drink.id } })
    res.status(200).json({ msg: 'deleted', drink: toClientJSON(drink) })
})

module.exports = { getDrinks, getDrink, createDrink, updateDrink, deleteDrink }
