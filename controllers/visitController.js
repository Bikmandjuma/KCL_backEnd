const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')

// Called (fire-and-forget) by the frontend on page load to track traffic
logVisit = asyncHandler(async(req,res)=>{
    const { path } = req.body
    await prisma.visit.create({ data: { path, userId: req.user ? req.user._id : null } })
    res.status(201).json({ ok: true })
})

module.exports = { logVisit }
