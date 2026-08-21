const asyncHandler = require('express-async-handler')
const { Op } = require('sequelize')
const CryptoJS = require('crypto-js')
const { User, Product } = require('../models')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')

//Get All Users - only by Admin/Manager(with permission)
//Supports ?search=&role=&page=&limit=
getUsers = asyncHandler(async(req,res)=>{
    const { search, role, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (role) where.role = role
    if (search) {
        where[Op.or] = [
            { username: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
        ]
    }

    if (!pageQ && !limitQ) {
        const users = await User.findAll({ where, attributes: { exclude: ['password'] } })
        return res.status(200).json(toClientJSON(users))
    }

    const { page, limit, offset } = getPagination(req.query, 10)
    const result = await User.findAndCountAll({
        where, attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']], limit, offset,
    })
    res.status(200).json(toClientJSON(buildPageResult(result, page, limit)))
})

//Get your own User
getUser = asyncHandler(async(req,res)=>{
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } })
    if (!user){
        res.status(400)
        throw new Error('No such user Found')
    }
    res.status(200).json(toClientJSON(user))
})

//Update your own User
updateUser = asyncHandler(async(req,res)=>{
    const userAvailable = await User.findByPk(req.params.id)
    if (!userAvailable){
        res.status(400)
        throw new Error('No such user Found')
    }
    const { username, email, password, phone, address } = req.body
    const updateData = { username, email, phone, address }
    if (password){
        updateData.password = CryptoJS.AES.encrypt(password, process.env.PASSWORD_KEY).toString()
    }

    await userAvailable.update(updateData)
    const { password: pw, ...others } = userAvailable.get({ plain: true })
    res.status(200).json(toClientJSON(others))
})

//Delete your own User
deleteUser = asyncHandler(async(req,res)=>{
    const user = await User.findByPk(req.params.id)
    if (!user){
        res.status(400)
        throw new Error('No User Available')
    }
    await user.destroy()
    res.status(200).json(toClientJSON({ id: user.id, username: user.username, email: user.email }))
})

//Get User Wishlist
getWishlist = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const user = await User.findByPk(userId, {
        include: [{ model: Product, as: 'wishlist' }]
    })
    if (!user){ res.status(400); throw new Error('No such user Found') }
    res.status(200).json(toClientJSON({ username: user.username, wishlist: user.wishlist }))
})

//Save the Address of the User
saveUserAddress = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const { address } = req.body
    const user = await User.findByPk(userId)
    await user.update({ address })
    res.json(toClientJSON({ username: user.username, address: user.address }))
})

// ---------------- Admin: Staff / Role management ----------------

// Admin creates a Manager or another Admin account with specific permissions
createStaff = asyncHandler(async(req,res)=>{
    const { username, email, password, role, permissions, phone } = req.body
    if (!username || !email || !password || !role){
        res.status(400)
        throw new Error('username, email, password and role are mandatory')
    }
    if (!['admin','manager'].includes(role)){
        res.status(400)
        throw new Error('role must be admin or manager')
    }
    const usernameAvailable = await User.findOne({ where: { username } })
    if (usernameAvailable){ res.status(400); throw new Error('UserName Taken') }
    const emailAvailable = await User.findOne({ where: { email } })
    if (emailAvailable){ res.status(400); throw new Error('Email Taken') }

    const hashedPassword = CryptoJS.AES.encrypt(password, process.env.PASSWORD_KEY).toString()
    const user = await User.create({
        username, email, phone,
        password: hashedPassword,
        role,
        isAdmin: role === 'admin',
        permissions: role === 'admin' ? {
            manageProducts: true, manageDrinks: true, manageOrders: true,
            manageUsers: true, manageSettings: true, viewDashboard: true, manageBarista: true
        } : (permissions || {})
    })
    const { password: pw, ...others } = user.get({ plain: true })
    res.status(201).json(toClientJSON(others))
})

// Admin updates a staff member's role / permissions / active state
updateStaff = asyncHandler(async(req,res)=>{
    const { role, permissions, active } = req.body
    const target = await User.findByPk(req.params.id)
    if (!target){ res.status(404); throw new Error('User not found') }

    const update = {}
    if (role){
        if (!['admin','manager','guest'].includes(role)){
            res.status(400); throw new Error('Invalid role')
        }
        update.role = role
        update.isAdmin = role === 'admin'
    }
    if (permissions) update.permissions = permissions
    if (typeof active === 'boolean') update.active = active

    await target.update(update)
    const { password: pw, ...others } = target.get({ plain: true })
    res.status(200).json(toClientJSON(others))
})

module.exports = { getUsers, getUser, updateUser, deleteUser, getWishlist, saveUserAddress, createStaff, updateStaff }
