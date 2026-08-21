const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// A barista-training intake window that Admin publishes. Applications are
// only accepted while a session is `active` and within its date range.
const BaristaSession = sequelize.define('BaristaSession', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    startDate: { type: DataTypes.DATEONLY },
    endDate: { type: DataTypes.DATEONLY },
    capacity: { type: DataTypes.INTEGER, defaultValue: 20 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
    tableName: 'barista_sessions',
    timestamps: true,
})

module.exports = BaristaSession
