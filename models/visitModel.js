const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// One row per site visit, used purely for dashboard analytics
const Visit = sequelize.define('Visit', {
    path: { type: DataTypes.STRING },
}, {
    tableName: 'visits',
    timestamps: true,
    updatedAt: false,
})

module.exports = Visit
