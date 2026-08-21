const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

// Default permission map. Admin always has all permissions regardless of this object.
// Manager permissions are granted individually by the Admin.
const defaultPermissions = {
    manageProducts: false,
    manageDrinks: false,
    manageOrders: false,
    manageUsers: false,
    manageSettings: false,
    viewDashboard: false,
    manageBarista: false,
}

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    // role drives access across the app: admin | manager | guest (client)
    role: { type: DataTypes.ENUM('admin', 'manager', 'guest'), defaultValue: 'guest' },
    // kept for backward compatibility with existing token/middleware checks
    isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
    permissions: { type: DataTypes.JSON, defaultValue: defaultPermissions },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
    tableName: 'users',
    timestamps: true,
})

module.exports = User
