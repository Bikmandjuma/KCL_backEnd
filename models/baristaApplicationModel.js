const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// A submitted barista-training application form (Rwanda administrative
// address: province / district / sector / cell / village).
const BaristaApplication = sequelize.define('BaristaApplication', {
    fullName: { type: DataTypes.STRING, allowNull: false },
    gender: { type: DataTypes.ENUM('Male', 'Female', 'Other'), allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    province: { type: DataTypes.STRING },
    district: { type: DataTypes.STRING },
    sector: { type: DataTypes.STRING },
    cell: { type: DataTypes.STRING },
    village: { type: DataTypes.STRING },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        defaultValue: 'Pending',
    },
    notes: { type: DataTypes.TEXT },
}, {
    tableName: 'barista_applications',
    timestamps: true,
})

module.exports = BaristaApplication
