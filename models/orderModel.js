const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/dbConnection')

const Order = sequelize.define('Order', {
    // How the customer intends to / did pay
    paymentMethod: {
        type: DataTypes.ENUM('COD', 'Stripe', 'MTN Mobile Money', 'Manual Proof'),
        defaultValue: 'COD',
    },
    paymentIntentId: { type: DataTypes.STRING },
    paymentAmount: { type: DataTypes.FLOAT },
    paymentCurrency: { type: DataTypes.STRING, defaultValue: 'RWF' },
    paymentStatus: { type: DataTypes.STRING },
    // Client uploads a screenshot/photo proving they paid (after calling the lab)
    proofOfPayment: { type: DataTypes.STRING },
    callConfirmed: { type: DataTypes.BOOLEAN, defaultValue: false },
    orderStatus: {
        type: DataTypes.ENUM(
            'Not Processed', 'Awaiting Proof', 'Cash on Delivery',
            'Processing', 'Dispatched', 'Cancelled', 'Delivered'
        ),
        defaultValue: 'Not Processed',
    },
    email: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    contact: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
}, {
    tableName: 'orders',
    timestamps: true,
})

module.exports = Order
