const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// A snapshotted line-item inside an Order
const OrderItem = sequelize.define('OrderItem', {
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    title: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING },
    price: { type: DataTypes.FLOAT },
}, {
    tableName: 'order_items',
    timestamps: true,
})

module.exports = OrderItem
