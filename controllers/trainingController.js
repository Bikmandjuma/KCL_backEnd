const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')
const { toNumber } = require('../utils/coerce')

// The 4 Coffee Training courses. Barista is a local, shop-run course with no
// certification level; the other three each lead toward a global
// certification and are offered at 3 levels.
const COURSE_TYPES = ['barista', 'cupping', 'roasting', 'cva']
const COURSE_LEVELS = ['Foundation', 'Intermediate', 'Professional']
const GLOBAL_CERT_COURSES = ['cupping', 'roasting', 'cva']

const assertCourseType = (courseType) => {
    if (!COURSE_TYPES.includes(courseType)) {
        const err = new Error(`courseType must be one of: ${COURSE_TYPES.join(', ')}`)
        err.status = 400
        throw err
    }
}

const todayDate = () => new Date(new Date().toISOString().slice(0, 10))

// Public - every open (active, within date range) session across all 4
// courses at once, so the Course pages can each show their own countdown
// without a separate request per course/level.
getActiveSessions = asyncHandler(async (req, res) => {
    const today = todayDate()
    const sessions = await prisma.trainingSession.findMany({
        where: {
            active: true,
            OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        orderBy: [{ courseType: 'asc' }, { level: 'asc' }, { createdAt: 'desc' }],
    })
    // One open session per courseType+level combination is what each course
    // page actually needs (the latest one, if a course was re-published).
    const latestByKey = new Map()
    for (const s of sessions) {
        const key = `${s.courseType}:${s.level || ''}`
        if (!latestByKey.has(key)) latestByKey.set(key, s)
    }
    const withSeatCounts = await Promise.all(
        [...latestByKey.values()].map(async (s) => {
            const taken = await prisma.trainingApplication.count({ where: { sessionId: s.id } })
            return { ...s, seatsTaken: taken, seatsLeft: Math.max(0, s.capacity - taken) }
        })
    )
    res.status(200).json(toClientJSON(withSeatCounts))
})

// Public - submit an application against a specific open session
applyToTraining = asyncHandler(async (req, res) => {
    const { sessionId, fullName, gender, phone, email, province, district, sector, cell, village } = req.body
    if (!sessionId || !fullName || !gender || !phone || !email) {
        res.status(400)
        throw new Error('Session, name, gender, phone and email are mandatory')
    }
    const session = await prisma.trainingSession.findUnique({ where: { id: Number(sessionId) } })
    if (!session || !session.active) {
        res.status(400)
        throw new Error('That training session is not open for applications right now')
    }
    const today = todayDate()
    if (session.endDate && session.endDate < today) {
        res.status(400)
        throw new Error('Applications for this session have closed')
    }
    const currentCount = await prisma.trainingApplication.count({ where: { sessionId: session.id } })
    if (currentCount >= session.capacity) {
        res.status(400)
        throw new Error('This training session is already full. Please check back for the next cohort.')
    }
    const application = await prisma.trainingApplication.create({
        data: { fullName, gender, phone, email, province, district, sector, cell, village, sessionId: session.id },
    })
    res.status(201).json(toClientJSON(application))
})

// ---------------- Admin/Manager (manageTrainings permission) ----------------

// All sessions, optionally scoped to one courseType (and/or level), newest first
getSessions = asyncHandler(async (req, res) => {
    const { courseType, level } = req.query
    const where = {}
    if (courseType) { assertCourseType(courseType); where.courseType = courseType }
    if (level) where.level = level
    const sessions = await prisma.trainingSession.findMany({
        where,
        orderBy: [{ courseType: 'asc' }, { level: 'asc' }, { createdAt: 'desc' }],
    })
    const withCounts = await Promise.all(
        sessions.map(async (s) => {
            const taken = await prisma.trainingApplication.count({ where: { sessionId: s.id } })
            return { ...s, seatsTaken: taken }
        })
    )
    res.status(200).json(toClientJSON(withCounts))
})

// Create a new session/cohort, e.g. "2026 Cohort 1". Publishing a new active
// session automatically closes any other open session for the SAME
// courseType+level (so each course/level track only ever has one open
// cohort at a time) - different courses/levels are independent.
createSession = asyncHandler(async (req, res) => {
    const { courseType, level, title, description, startDate, endDate, capacity, active } = req.body
    assertCourseType(courseType)
    if (GLOBAL_CERT_COURSES.includes(courseType) && !COURSE_LEVELS.includes(level)) {
        res.status(400)
        throw new Error(`level is mandatory for ${courseType} and must be one of: ${COURSE_LEVELS.join(', ')}`)
    }
    if (!title) { res.status(400); throw new Error('Title is mandatory') }

    const resolvedLevel = GLOBAL_CERT_COURSES.includes(courseType) ? level : null
    if (active !== false && active !== 'false') {
        await prisma.trainingSession.updateMany({
            where: { active: true, courseType, level: resolvedLevel },
            data: { active: false },
        })
    }
    const session = await prisma.trainingSession.create({
        data: {
            courseType, level: resolvedLevel, title, description,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            capacity: toNumber(capacity) ?? 20,
            active: active !== false && active !== 'false',
        },
    })
    res.status(201).json(toClientJSON(session))
})

updateSession = asyncHandler(async (req, res) => {
    const session = await prisma.trainingSession.findUnique({ where: { id: Number(req.params.id) } })
    if (!session) { res.status(404); throw new Error('Session not found') }

    const { title, description, startDate, endDate, capacity, active, level } = req.body
    if (active === true || active === 'true') {
        await prisma.trainingSession.updateMany({
            where: { active: true, courseType: session.courseType, level: session.level },
            data: { active: false },
        })
    }
    const data = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    if (capacity !== undefined) data.capacity = toNumber(capacity)
    if (active !== undefined) data.active = active === true || active === 'true'
    if (level !== undefined && GLOBAL_CERT_COURSES.includes(session.courseType)) data.level = level

    const updated = await prisma.trainingSession.update({ where: { id: session.id }, data })
    res.status(200).json(toClientJSON(updated))
})

deleteSession = asyncHandler(async (req, res) => {
    const session = await prisma.trainingSession.findUnique({ where: { id: Number(req.params.id) } })
    if (!session) { res.status(404); throw new Error('Session not found') }
    await prisma.trainingSession.delete({ where: { id: session.id } })
    res.status(200).json({ msg: 'deleted' })
})

// Paginated + searchable list of applications, optionally scoped to a
// session, courseType, and/or status
getApplications = asyncHandler(async (req, res) => {
    const { search, sessionId, courseType, status } = req.query
    const where = {}
    if (sessionId) where.sessionId = Number(sessionId)
    if (status) where.status = status
    if (courseType) {
        assertCourseType(courseType)
        where.session = { courseType }
    }
    if (search) {
        where.OR = [
            { fullName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
        ]
    }
    const { page, limit, offset } = getPagination(req.query, 10)
    const [rows, count] = await Promise.all([
        prisma.trainingApplication.findMany({
            where,
            include: { session: { select: { id: true, title: true, courseType: true, level: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit, skip: offset,
        }),
        prisma.trainingApplication.count({ where }),
    ])
    res.status(200).json(toClientJSON(buildPageResult({ rows, count }, page, limit)))
})

updateApplicationStatus = asyncHandler(async (req, res) => {
    const { status, notes } = req.body
    const application = await prisma.trainingApplication.findUnique({ where: { id: Number(req.params.id) } })
    if (!application) { res.status(404); throw new Error('Application not found') }
    const data = {}
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes
    const updated = await prisma.trainingApplication.update({ where: { id: application.id }, data })
    res.status(200).json(toClientJSON(updated))
})

module.exports = {
    getActiveSessions, applyToTraining,
    getSessions, createSession, updateSession, deleteSession,
    getApplications, updateApplicationStatus,
}
