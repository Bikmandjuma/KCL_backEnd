const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

const Cart = sequelize.define('Cart', {
    total: { type: DataTypes.FLOAT, defaultValue: 0 },
}, {
    tableName: 'carts',
    timestamps: true,
})

module.exports = Cart
