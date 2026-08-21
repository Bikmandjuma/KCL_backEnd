const { Cart, CartItem, Product } = require('../models')
const { toClientJSON } = require('../utils/transform')

const recalcTotal = async (cart) => {
    const items = await CartItem.findAll({ where: { cartId: cart.id } })
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    await cart.update({ total })
    return total
}

const getOrCreateCart = async (userId) => {
    let cart = await Cart.findOne({ where: { userId } })
    if (!cart) cart = await Cart.create({ userId })
    return cart
}

exports.addItemToCart = async (req, res) => {
    const userId = req.user._id
    let { productId, quantity, title, price, image } = req.body
    if (!productId)
        return res.status(400).send({ status: false, message: 'Invalid product' })

    const productAvailable = await Product.findByPk(productId)
    if (!productAvailable)
        return res.status(404).send({ status: false, message: 'Product not found' })
    if (productAvailable.quantity < quantity)
        return res.status(400).send({ status: false, message: `Only ${productAvailable.quantity} left in stock` })

    const cart = await getOrCreateCart(userId)
    let item = await CartItem.findOne({ where: { cartId: cart.id, productId } })
    if (item) {
        await item.update({ quantity: item.quantity + quantity })
    } else {
        item = await CartItem.create({ cartId: cart.id, productId, quantity, title, image, price })
    }
    await recalcTotal(cart)

    const updatedCart = await Cart.findByPk(cart.id, { include: [{ model: CartItem, as: 'products' }] })
    return res.status(200).send({ status: true, updatedCart: toClientJSON(updatedCart) })
}

exports.getCart = async (req, res) => {
    const userId = req.user._id
    const cart = await Cart.findOne({ where: { userId }, include: [{ model: CartItem, as: 'products' }] })
    if (!cart)
        return res.status(200).send({ status: true, cart: { products: [], total: 0 }, cartCount: 0 })

    res.status(200).send({ status: true, cart: toClientJSON(cart), cartCount: cart.products.length })
}

exports.decreaseQuantity = async (req, res) => {
    const userId = req.user._id
    const { productId, quantity } = req.body

    const cart = await Cart.findOne({ where: { userId } })
    if (!cart)
        return res.status(404).send({ status: false, message: 'Cart not found for this user' })

    const item = await CartItem.findOne({ where: { cartId: cart.id, productId } })
    if (item) {
        const newQty = item.quantity - quantity
        if (newQty <= 0) await item.destroy()
        else await item.update({ quantity: newQty })
        await recalcTotal(cart)
        const updatedCart = await Cart.findByPk(cart.id, { include: [{ model: CartItem, as: 'products' }] })
        return res.status(200).send({ status: true, updatedCart: toClientJSON(updatedCart) })
    }
    res.status(400).send({ status: false, message: 'Item does not exist in cart' })
}

exports.removeItem = async (req, res) => {
    const userId = req.user._id
    const { productId } = req.body

    const cart = await Cart.findOne({ where: { userId } })
    if (!cart)
        return res.status(404).json({ status: false, message: 'Cart not found for this user' })

    const item = await CartItem.findOne({ where: { cartId: cart.id, productId } })
    if (item) {
        await item.destroy()
        await recalcTotal(cart)
        const updatedCart = await Cart.findByPk(cart.id, { include: [{ model: CartItem, as: 'products' }] })
        return res.status(200).json({ status: true, updatedCart: toClientJSON(updatedCart) })
    }
    return res.status(400).json({ status: false, message: 'Item does not exist in cart' })
}

exports.deleteCart = async (req, res) => {
    const userId = req.user._id
    try {
        const cart = await Cart.findOne({ where: { userId } })
        if (cart) {
            await CartItem.destroy({ where: { cartId: cart.id } })
            await cart.update({ total: 0 })
        }
        res.status(200).json({ message: 'Products removed from the cart successfully.' })
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' })
    }
}
