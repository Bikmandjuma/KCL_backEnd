const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')
const { toNumber, toBool } = require('../utils/coerce')

// Public - the History page. Active stories only, in the order Admin set.
getStories = asyncHandler(async (req, res) => {
    const { all } = req.query
    const where = all ? {} : { active: true }
    const stories = await prisma.staffStory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    res.status(200).json(toClientJSON(stories))
})

getStory = asyncHandler(async (req, res) => {
    const story = await prisma.staffStory.findUnique({ where: { id: Number(req.params.id) } })
    if (!story) { res.status(404); throw new Error('Story not found') }
    res.status(200).json(toClientJSON(story))
})

// Staff (manageHistory). Accepts a cover image plus up to 6 gallery photos
// (multipart, see uploadHandler's uploadStaffStory).
createStory = asyncHandler(async (req, res) => {
    const { employeeName, roleTitle, story, active, sortOrder } = req.body
    if (!employeeName || !story) {
        res.status(400)
        throw new Error('Employee name and their story are mandatory')
    }
    const files = req.files || {}
    if (!files.coverImage?.[0]) {
        res.status(400)
        throw new Error('A cover photo is required')
    }
    const gallery = (files.gallery || []).map((f) => `/uploads/staff/${f.filename}`)

    const created = await prisma.staffStory.create({
        data: {
            employeeName, roleTitle, story,
            coverImage: `/uploads/staff/${files.coverImage[0].filename}`,
            gallery,
            active: active === undefined ? true : toBool(active),
            sortOrder: toNumber(sortOrder) ?? 0,
        },
    })
    res.status(201).json(toClientJSON(created))
})

updateStory = asyncHandler(async (req, res) => {
    const existing = await prisma.staffStory.findUnique({ where: { id: Number(req.params.id) } })
    if (!existing) { res.status(404); throw new Error('Story not found') }

    const { employeeName, roleTitle, story, active, sortOrder, keepGallery } = req.body
    const data = {}
    if (employeeName !== undefined) data.employeeName = employeeName
    if (roleTitle !== undefined) data.roleTitle = roleTitle
    if (story !== undefined) data.story = story
    if (active !== undefined) data.active = toBool(active)
    if (sortOrder !== undefined) data.sortOrder = toNumber(sortOrder)

    const files = req.files || {}
    if (files.coverImage?.[0]) data.coverImage = `/uploads/staff/${files.coverImage[0].filename}`

    // Gallery management: the client sends back `keepGallery` (JSON array of
    // existing paths it still wants to keep) alongside any new `gallery`
    // files to append - lets the admin remove individual old photos without
    // re-uploading everything.
    let gallery = existing.gallery || []
    if (keepGallery !== undefined) {
        try { gallery = JSON.parse(keepGallery) } catch (e) { /* ignore malformed input, keep existing */ }
    }
    if (files.gallery?.length) {
        gallery = [...gallery, ...files.gallery.map((f) => `/uploads/staff/${f.filename}`)]
    }
    if (keepGallery !== undefined || files.gallery?.length) data.gallery = gallery

    const updated = await prisma.staffStory.update({ where: { id: existing.id }, data })
    res.status(200).json(toClientJSON(updated))
})

deleteStory = asyncHandler(async (req, res) => {
    const story = await prisma.staffStory.findUnique({ where: { id: Number(req.params.id) } })
    if (!story) { res.status(404); throw new Error('Story not found') }
    await prisma.staffStory.delete({ where: { id: story.id } })
    res.status(200).json({ msg: 'deleted' })
})

module.exports = { getStories, getStory, createStory, updateStory, deleteStory }
