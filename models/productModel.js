const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// Products represent Coffee Machines sold by Kigali Coffee Lab (KCL)
const Product = sequelize.define('Product', {
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    price: { type: DataTypes.FLOAT, allowNull: false },
    categories: { type: DataTypes.STRING, allowNull: false }, // e.g. Espresso Machine
    brand: { type: DataTypes.STRING },
    quantity: { type: DataTypes.INTEGER, defaultValue: 0 }, // stock left in store
    sold: { type: DataTypes.INTEGER, defaultValue: 0 },
    color: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING, allowNull: false },
    gallery: { type: DataTypes.JSON, defaultValue: [] },
    desc: { type: DataTypes.TEXT },
    size: { type: DataTypes.STRING },
    featured: { type: DataTypes.BOOLEAN, defaultValue: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true }, // admin can hide without deleting
    totalRatings: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
    tableName: 'products',
    timestamps: true,
})

module.exports = Product
