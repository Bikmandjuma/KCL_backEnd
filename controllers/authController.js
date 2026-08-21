const asyncHandler = require('express-async-handler')
const CryptoJS = require('crypto-js')
const jwt = require('jsonwebtoken')
const { User, Cart } = require('../models')
const { toClientJSON } = require('../utils/transform')

//To Register a User - public registration always creates a "guest" (client) account.
//Admin/Manager accounts are created from the Admin panel only (see userController.createStaff)
userRegister = asyncHandler(async(req,res)=>{
    const { username, email, password, phone } = req.body
    if (!username || !email || !password){
        res.status(400)
        throw new Error('All fields are mandatory')
    }

    const usernameAvailable = await User.findOne({ where: { username } })
    if (usernameAvailable){
        res.status(400)
        throw new Error('UserName Taken')
    }
    const emailAvailable = await User.findOne({ where: { email } })
    if (emailAvailable){
        res.status(400)
        throw new Error('Email Taken')
    }
    const hashedPassword = CryptoJS.AES.encrypt(password, process.env.PASSWORD_KEY).toString()
    const user = await User.create({
        username, email, password: hashedPassword, phone, role: 'guest', isAdmin: false
    })
    const { password: pw, ...others } = user.get({ plain: true })
    res.status(201).json(toClientJSON(others))
})

//To Login using existing Users
loginUser = asyncHandler(async(req,res)=>{
    const { email, password } = req.body
    if (!email || !password){
        res.status(400)
        throw new Error('All fields are mandatory')
    }
    const user = await User.findOne({ where: { email } })

    if (!user){
        res.status(400)
        throw new Error('No such User')
    }
    if (user.active === false){
        res.status(403)
        throw new Error('This account has been deactivated. Please contact the Coffee Lab.')
    }
    const decryptedPassword = CryptoJS.AES.decrypt(user.password, process.env.PASSWORD_KEY).toString(CryptoJS.enc.Utf8)
    if (decryptedPassword!=password){
        res.status(400)
        throw new Error('Invalid Password')
    }
    const accessToken = jwt.sign({
        _id: user.id,
        isAdmin: user.isAdmin || user.role === 'admin',
        role: user.role,
        permissions: user.permissions,
    }, process.env.JWT_KEY,{expiresIn: '1d'})

    let cart = await Cart.findOne({ where: { userId: user.id } })
    if (!cart){
        cart = await Cart.create({ userId: user.id })
    }

    res.status(200).json(toClientJSON({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin || user.role === 'admin',
        permissions: user.permissions,
        accessToken,
    }))
})

module.exports = { userRegister, loginUser }
