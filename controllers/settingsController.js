const asyncHandler = require('express-async-handler')
const { Settings } = require('../models')
const { toClientJSON } = require('../utils/transform')

const getOrCreate = async () => {
    let settings = await Settings.findOne()
    if (!settings) settings = await Settings.create({})
    return settings
}

// Public - the storefront needs to know which payment options are visible
getPublicSettings = asyncHandler(async(req,res)=>{
    const settings = await getOrCreate()
    res.status(200).json(toClientJSON({
        siteName: settings.siteName,
        tagline: settings.tagline,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        mtnNumber: settings.mtnNumber,
        mtnCode: settings.mtnCode,
        payments: {
            stripeEnabled: settings.stripeEnabled,
            mtnEnabled: settings.mtnEnabled,
            codEnabled: settings.codEnabled,
            manualProofEnabled: settings.manualProofEnabled,
        }
    }))
})

// Admin only - full settings document (flattened payment fields -> nested `payments` for the frontend)
getSettings = asyncHandler(async(req,res)=>{
    const settings = await getOrCreate()
    const plain = settings.get({ plain: true })
    res.status(200).json(toClientJSON({
        ...plain,
        payments: {
            stripeEnabled: plain.stripeEnabled,
            mtnEnabled: plain.mtnEnabled,
            codEnabled: plain.codEnabled,
            manualProofEnabled: plain.manualProofEnabled,
        }
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
    await settings.update(body)
    const plain = settings.get({ plain: true })
    res.status(200).json(toClientJSON({
        ...plain,
        payments: {
            stripeEnabled: plain.stripeEnabled,
            mtnEnabled: plain.mtnEnabled,
            codEnabled: plain.codEnabled,
            manualProofEnabled: plain.manualProofEnabled,
        }
    }))
})

module.exports = { getPublicSettings, getSettings, updateSettings }
