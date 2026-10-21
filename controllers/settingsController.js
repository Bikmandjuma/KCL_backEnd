const asyncHandler = require('express-async-handler')
const { prisma } = require('../config/dbConnection')
const { toClientJSON } = require('../utils/transform')

const getOrCreate = async () => {
    let settings = await prisma.settings.findFirst()
    if (!settings) settings = await prisma.settings.create({ data: {} })
    return settings
}

const paymentsShape = (plain) => ({
    cashEnabled: plain.cashEnabled,
    momoPayEnabled: plain.momoPayEnabled,
    momoCodeEnabled: plain.momoCodeEnabled,
})

// Public - the app needs this to know which of Cash/MoMo Pay/MoMo Code to
// show at checkout, and the actual number/code to pay to for the MoMo options.
getPublicSettings = asyncHandler(async(req,res)=>{
    const settings = await getOrCreate()
    res.status(200).json(toClientJSON({
        siteName: settings.siteName,
        tagline: settings.tagline,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        momoPayNumber: settings.momoPayNumber,
        momoCode: settings.momoCode,
        payments: paymentsShape(settings),
    }))
})

// Admin only - full settings document (flattened payment fields -> nested `payments` for the frontend)
getSettings = asyncHandler(async(req,res)=>{
    const settings = await getOrCreate()
    res.status(200).json(toClientJSON({
        ...settings,
        payments: paymentsShape(settings),
    }))
})

updateSettings = asyncHandler(async(req,res)=>{
    const settings = await getOrCreate()
    const body = { ...req.body }
    // accept either flattened fields or a nested `payments` object from the frontend
    if (body.payments){
        Object.assign(body, body.payments)
        delete body.payments
    }
    const allowed = ['siteName','tagline','phone','whatsapp','address','cashEnabled','momoPayEnabled','momoCodeEnabled','momoPayNumber','momoCode']
    const data = {}
    for (const key of allowed) if (body[key] !== undefined) data[key] = body[key]

    const updated = await prisma.settings.update({ where: { id: settings.id }, data })
    res.status(200).json(toClientJSON({
        ...updated,
        payments: paymentsShape(updated),
    }))
})

module.exports = { getPublicSettings, getSettings, updateSettings }
