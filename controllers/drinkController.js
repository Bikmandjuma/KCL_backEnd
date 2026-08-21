const asyncHandler = require('express-async-handler')
const { Op } = require('sequelize')
const { Drink } = require('../models')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')

// Public - the KCL menu (Hot Drinks / Cold Drinks / Specialty)
// Supports ?category=&search=&page=&limit=&all=true (staff only, sees hidden drinks)
getDrinks = asyncHandler(async(req,res)=>{
    const { category, all, search, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (!all) where.available = true
    if (category) where.category = category
    if (search) where.name = { [Op.like]: `%${search}%` }

    // The storefront's simple menu tabs just want a flat array (no paging UI there yet)
    if (!pageQ && !limitQ && !all) {
        const drinks = await Drink.findAll({ where, order: [['createdAt', 'DESC']] })
        return res.status(200).json(toClientJSON(drinks))
    }

    const { page, limit, offset } = getPagination(req.query, 12)
    const result = await Drink.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset })
    res.status(200).json(toClientJSON(buildPageResult(result, page, limit)))
})

getDrink = asyncHandler(async(req,res)=>{
    const drink = await Drink.findByPk(req.params.id)
    if (!drink){ res.status(404); throw new Error('Drink not found') }
    res.status(200).json(toClientJSON(drink))
})

createDrink = asyncHandler(async(req,res)=>{
    const { name, price, category, desc } = req.body
    if (!name || !price){ res.status(400); throw new Error('name and price are mandatory') }
    const body = { name, price, category, desc, listedById: req.user._id }
    if (req.file) body.image = `/uploads/drinks/${req.file.filename}`
    const drink = await Drink.create(body)
    res.status(201).json(toClientJSON(drink))
})

updateDrink = asyncHandler(async(req,res)=>{
    const drink = await Drink.findByPk(req.params.id)
    if (!drink){ res.status(404); throw new Error('Drink not found') }
    const body = { ...req.body }
    if (req.file) body.image = `/uploads/drinks/${req.file.filename}`
    await drink.update(body)
    res.status(200).json(toClientJSON(drink))
})

deleteDrink = asyncHandler(async(req,res)=>{
    const drink = await Drink.findByPk(req.params.id)
    if (!drink){ res.status(404); throw new Error('Drink not found') }
    await drink.destroy()
    res.status(200).json({ msg: 'deleted', drink: toClientJSON(drink) })
})

module.exports = { getDrinks, getDrink, createDrink, updateDrink, deleteDrink }
