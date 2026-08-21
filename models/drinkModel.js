const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// Drinks represent the KCL menu (Hot Drinks, Cold Drinks, etc.)
const Drink = sequelize.define('Drink', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    category: { type: DataTypes.ENUM('Hot Drinks', 'Cold Drinks', 'Specialty'), defaultValue: 'Hot Drinks' },
    image: { type: DataTypes.STRING },
    desc: { type: DataTypes.TEXT },
    available: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
    tableName: 'drinks',
    timestamps: true,
})

module.exports = Drink
