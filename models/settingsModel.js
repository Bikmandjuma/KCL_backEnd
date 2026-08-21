const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// Singleton row holding site-wide, admin-controlled configuration
const Settings = sequelize.define('Settings', {
    siteName: { type: DataTypes.STRING, defaultValue: 'Kigali Coffee Lab' },
    tagline: { type: DataTypes.STRING, defaultValue: 'Roasted with passion, brewed with purpose.' },
    phone: { type: DataTypes.STRING, defaultValue: '+250 700 000 000' },
    whatsapp: { type: DataTypes.STRING, defaultValue: '+250 700 000 000' },
    address: { type: DataTypes.STRING, defaultValue: 'KG 7 Ave, Kigali, Rwanda' },
    stripeEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    mtnEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    codEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    manualProofEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    mtnNumber: { type: DataTypes.STRING, defaultValue: '073 000 0000' },
    mtnCode: { type: DataTypes.STRING, defaultValue: '' }, // MTN MoMo Pay merchant/till code
}, {
    tableName: 'settings',
    timestamps: true,
})

module.exports = Settings
