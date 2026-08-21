const asyncHandler = require('express-async-handler')
const { Op } = require('sequelize')
const { BaristaSession, BaristaApplication } = require('../models')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')

// Public - the storefront shows the currently open session (if any) on the
// Services page, and only lets people apply while one is active.
getActiveSession = asyncHandler(async(req,res)=>{
    const today = new Date().toISOString().slice(0, 10)
    const session = await BaristaSession.findOne({
        where: {
            active: true,
            [Op.or]: [
                { endDate: null },
                { endDate: { [Op.gte]: today } },
            ],
        },
        order: [['createdAt', 'DESC']],
    })
    res.status(200).json(toClientJSON(session))
})

// Public - submit an application against the currently active session
applyToBarista = asyncHandler(async(req,res)=>{
    const { fullName, gender, phone, email, province, district, sector, cell, village } = req.body
    if (!fullName || !gender || !phone || !email){
        res.status(400)
        throw new Error('Name, gender, phone and email are mandatory')
    }
    const today = new Date().toISOString().slice(0, 10)
    const session = await BaristaSession.findOne({
        where: {
            active: true,
            [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: today } }],
        },
        order: [['createdAt', 'DESC']],
    })
    if (!session){
        res.status(400)
        throw new Error('There is no open barista training session right now. Please check back soon.')
    }

    const currentCount = await BaristaApplication.count({ where: { sessionId: session.id } })
    if (currentCount >= session.capacity){
        res.status(400)
        throw new Error('This training session is already full. Please check back for the next session.')
    }

    const application = await BaristaApplication.create({
        fullName, gender, phone, email, province, district, sector, cell, village,
        sessionId: session.id,
    })
    res.status(201).json(toClientJSON(application))
})

// ---------------- Admin/Manager (manageBarista permission) ----------------

getSessions = asyncHandler(async(req,res)=>{
    const sessions = await BaristaSession.findAll({ order: [['createdAt', 'DESC']] })
    res.status(200).json(toClientJSON(sessions))
})

createSession = asyncHandler(async(req,res)=>{
    const { title, description, startDate, endDate, capacity, active } = req.body
    if (!title){ res.status(400); throw new Error('Title is mandatory') }
    // publishing a new active session automatically closes any other open ones
    if (active !== false){
        await BaristaSession.update({ active: false }, { where: { active: true } })
    }
    const session = await BaristaSession.create({ title, description, startDate, endDate, capacity, active: active !== false })
    res.status(201).json(toClientJSON(session))
})

updateSession = asyncHandler(async(req,res)=>{
    const session = await BaristaSession.findByPk(req.params.id)
    if (!session){ res.status(404); throw new Error('Session not found') }
    if (req.body.active === true){
        await BaristaSession.update({ active: false }, { where: { active: true } })
    }
    await session.update(req.body)
    res.status(200).json(toClientJSON(session))
})

deleteSession = asyncHandler(async(req,res)=>{
    const session = await BaristaSession.findByPk(req.params.id)
    if (!session){ res.status(404); throw new Error('Session not found') }
    await session.destroy()
    res.status(200).json({ msg: 'deleted' })
})

// Paginated + searchable list of applications, optionally scoped to one session
getApplications = asyncHandler(async(req,res)=>{
    const { search, sessionId, status } = req.query
    const where = {}
    if (sessionId) where.sessionId = sessionId
    if (status) where.status = status
    if (search) {
        where[Op.or] = [
            { fullName: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phone: { [Op.like]: `%${search}%` } },
        ]
    }
    const { page, limit, offset } = getPagination(req.query, 10)
    const result = await BaristaApplication.findAndCountAll({
        where,
        include: [{ model: BaristaSession, as: 'session', attributes: ['id', 'title'] }],
        order: [['createdAt', 'DESC']],
        limit, offset,
    })
    res.status(200).json(toClientJSON(buildPageResult(result, page, limit)))
})

updateApplicationStatus = asyncHandler(async(req,res)=>{
    const { status, notes } = req.body
    const application = await BaristaApplication.findByPk(req.params.id)
    if (!application){ res.status(404); throw new Error('Application not found') }
    await application.update({ status, notes })
    res.status(200).json(toClientJSON(application))
})

module.exports = {
    getActiveSession, applyToBarista,
    getSessions, createSession, updateSession, deleteSession,
    getApplications, updateApplicationStatus,
}
