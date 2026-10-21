const asyncHandler = require('express-async-handler')
const CryptoJS = require('crypto-js')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { allPermissions } = require('../utils/permissions')

// Prisma has no attributes-exclude helper, so select everything except password explicitly.
const userSelectNoPassword = {
    id: true, username: true, email: true, role: true, isAdmin: true,
    permissions: true, phone: true, address: true, active: true,
    createdAt: true, updatedAt: true,
}

//Get All Users - only by Admin/Manager(with permission)
//Supports ?search=&role=&page=&limit=
getUsers = asyncHandler(async(req,res)=>{
    const { search, role, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (role) where.role = role
    if (search) {
        where.OR = [
            { username: { contains: search } },
            { email: { contains: search } },
        ]
    }

    if (!pageQ && !limitQ) {
        const users = await prisma.user.findMany({ where, select: userSelectNoPassword })
        return res.status(200).json(toClientJSON(users))
    }

    const { page, limit, offset } = getPagination(req.query, 10)
    const [rows, count] = await Promise.all([
        prisma.user.findMany({ where, select: userSelectNoPassword, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        prisma.user.count({ where }),
    ])
    res.status(200).json(toClientJSON(buildPageResult({ rows, count }, page, limit)))
})

//Get your own User
getUser = asyncHandler(async(req,res)=>{
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) }, select: userSelectNoPassword })
    if (!user){
        res.status(400)
        throw new Error('No such user Found')
    }
    res.status(200).json(toClientJSON(user))
})

//Update your own User
updateUser = asyncHandler(async(req,res)=>{
    const userAvailable = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!userAvailable){
        res.status(400)
        throw new Error('No such user Found')
    }
    const { username, email, password, phone, address } = req.body
    const data = {}
    if (username !== undefined) data.username = username
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (address !== undefined) data.address = address
    if (password){
        data.password = CryptoJS.AES.encrypt(password, process.env.PASSWORD_KEY).toString()
    }

    const updated = await prisma.user.update({ where: { id: userAvailable.id }, data, select: userSelectNoPassword })
    res.status(200).json(toClientJSON(updated))
})

//Delete your own User
deleteUser = asyncHandler(async(req,res)=>{
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!user){
        res.status(400)
        throw new Error('No User Available')
    }
    await prisma.user.delete({ where: { id: user.id } })
    res.status(200).json(toClientJSON({ id: user.id, username: user.username, email: user.email }))
})

//Get User Wishlist
getWishlist = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user){ res.status(400); throw new Error('No such user Found') }
    const wishlistItems = await prisma.wishlist.findMany({ where: { userId }, include: { product: true } })
    res.status(200).json(toClientJSON({ username: user.username, wishlist: wishlistItems.map((w) => w.product) }))
})

//Save the Address of the User
saveUserAddress = asyncHandler(async(req,res)=>{
    const userId = req.user._id
    const { address } = req.body
    const user = await prisma.user.update({ where: { id: userId }, data: { address } })
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
    const usernameAvailable = await prisma.user.findUnique({ where: { username } })
    if (usernameAvailable){ res.status(400); throw new Error('UserName Taken') }
    const emailAvailable = await prisma.user.findUnique({ where: { email } })
    if (emailAvailable){ res.status(400); throw new Error('Email Taken') }

    const hashedPassword = CryptoJS.AES.encrypt(password, process.env.PASSWORD_KEY).toString()
    const user = await prisma.user.create({
        data: {
            username, email, phone,
            password: hashedPassword,
            role,
            isAdmin: role === 'admin',
            permissions: role === 'admin' ? allPermissions : (permissions || {}),
        },
    })
    const { password: pw, ...others } = user
    res.status(201).json(toClientJSON(others))
})

// Admin updates a staff member's role / permissions / active state
updateStaff = asyncHandler(async(req,res)=>{
    const { role, permissions, active } = req.body
    const target = await prisma.user.findUnique({ where: { id: Number(req.params.id) } })
    if (!target){ res.status(404); throw new Error('User not found') }

    const data = {}
    if (role){
        if (!['admin','manager','guest'].includes(role)){
            res.status(400); throw new Error('Invalid role')
        }
        data.role = role
        data.isAdmin = role === 'admin'
    }
    if (permissions) data.permissions = permissions
    if (typeof active === 'boolean') data.active = active

    const updated = await prisma.user.update({ where: { id: target.id }, data })
    const { password: pw, ...others } = updated
    res.status(200).json(toClientJSON(others))
})

module.exports = { getUsers, getUser, updateUser, deleteUser, getWishlist, saveUserAddress, createStaff, updateStaff }
