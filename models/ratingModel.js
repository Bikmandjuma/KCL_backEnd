const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// One row per user review on a product (Mongo used to embed these as an array)
const Rating = sequelize.define('Rating', {
    star: { type: DataTypes.INTEGER, allowNull: false },
    comments: { type: DataTypes.TEXT },
}, {
    tableName: 'ratings',
    timestamps: true,
})

module.exports = Rating
