const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// A snapshotted line-item inside a Cart (denormalised title/price/image, same
// as the old Mongo sub-document, so cart contents survive product edits).
const CartItem = sequelize.define('CartItem', {
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    title: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING },
    price: { type: DataTypes.FLOAT },
}, {
    tableName: 'cart_items',
    timestamps: true,
})

module.exports = CartItem
