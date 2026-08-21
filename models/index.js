// Central place where all Sequelize models are required and their
// associations (foreign keys / relations) are wired together.
const { sequelize } = require('../config/dbConnection')

const User = require('./userModel')
const Product = require('./productModel')
const Rating = require('./ratingModel')
const Drink = require('./drinkModel')
const Cart = require('./cartModel')
const CartItem = require('./cartItemModel')
const Order = require('./orderModel')
const OrderItem = require('./orderItemModel')
const Settings = require('./settingsModel')
const Visit = require('./visitModel')
const BaristaSession = require('./baristaSessionModel')
const BaristaApplication = require('./baristaApplicationModel')

// ---- Users <-> Products (who listed a machine / drink) ----
User.hasMany(Product, { foreignKey: 'listedById', as: 'listedProducts' })
Product.belongsTo(User, { foreignKey: 'listedById', as: 'listedBy' })

User.hasMany(Drink, { foreignKey: 'listedById', as: 'listedDrinks' })
Drink.belongsTo(User, { foreignKey: 'listedById', as: 'listedBy' })

// ---- Ratings (Product reviews) ----
Product.hasMany(Rating, { foreignKey: 'productId', as: 'ratings', onDelete: 'CASCADE' })
Rating.belongsTo(Product, { foreignKey: 'productId' })
User.hasMany(Rating, { foreignKey: 'userId' })
Rating.belongsTo(User, { foreignKey: 'userId', as: 'postedby' })

// ---- Wishlist (many-to-many User <-> Product) ----
User.belongsToMany(Product, { through: 'wishlists', as: 'wishlist', foreignKey: 'userId', otherKey: 'productId' })
Product.belongsToMany(User, { through: 'wishlists', as: 'wishlistedBy', foreignKey: 'productId', otherKey: 'userId' })

// ---- Cart ----
User.hasOne(Cart, { foreignKey: 'userId' })
Cart.belongsTo(User, { foreignKey: 'userId' })
Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'products', onDelete: 'CASCADE' })
CartItem.belongsTo(Cart, { foreignKey: 'cartId' })
CartItem.belongsTo(Product, { foreignKey: 'productId' })

// ---- Orders ----
User.hasMany(Order, { foreignKey: 'orderById', as: 'orders' })
Order.belongsTo(User, { foreignKey: 'orderById', as: 'orderby' })
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'products', onDelete: 'CASCADE' })
OrderItem.belongsTo(Order, { foreignKey: 'orderId' })
OrderItem.belongsTo(Product, { foreignKey: 'productId' })

// ---- Visits ----
User.hasMany(Visit, { foreignKey: 'userId' })
Visit.belongsTo(User, { foreignKey: 'userId' })

// ---- Barista training ----
BaristaSession.hasMany(BaristaApplication, { foreignKey: 'sessionId', as: 'applications', onDelete: 'CASCADE' })
BaristaApplication.belongsTo(BaristaSession, { foreignKey: 'sessionId', as: 'session' })

module.exports = {
    sequelize,
    User, Product, Rating, Drink,
    Cart, CartItem, Order, OrderItem,
    Settings, Visit,
    BaristaSession, BaristaApplication,
}
