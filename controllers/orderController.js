const asyncHandler = require('express-async-handler')
const { Op } = require('sequelize')
const uniqid = require('uniqid')
const { User, Cart, CartItem, Order, OrderItem, Product } = require('../models')
const { toClientJSON } = require('../utils/transform')
const { getPagination, buildPageResult } = require('../utils/paginate')

createOrder = asyncHandler(async(req,res)=>{
    const { address, email, contact, cartTotal, paymentMethod, callConfirmed, notes } = req.body
    const userId = req.user._id

    const cart = await Cart.findOne({ where: { userId }, include: [{ model: CartItem, as: 'products' }] })
    if (!cart || !cart.products.length){
        res.status(400)
        throw new Error('Your cart is empty')
    }

    const status = (paymentMethod === 'Manual Proof' || paymentMethod === 'MTN Mobile Money')
        ? 'Awaiting Proof'
        : 'Cash on Delivery'

    const order = await Order.create({
        orderById: userId,
        paymentIntentId: uniqid(),
        paymentMethod: paymentMethod || 'COD',
        paymentAmount: cartTotal,
        paymentCurrency: 'RWF',
        paymentStatus: status,
        callConfirmed: !!callConfirmed,
        email, address, contact, notes,
        orderStatus: status,
    })

    await OrderItem.bulkCreate(cart.products.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        title: item.title,
        image: item.image,
        price: item.price,
    })))

    // decrement stock, increment sold, best-effort
    try {
        for (const item of cart.products){
            const product = await Product.findByPk(item.productId)
            if (product){
                await product.update({
                    quantity: Math.max(0, product.quantity - item.quantity),
                    sold: product.sold + item.quantity,
                })
            }
        }
    } catch (e) { /* non-fatal */ }

    await CartItem.destroy({ where: { cartId: cart.id } })
    await cart.update({ total: 0 })

    const fullOrder = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'products' }] })
    res.status(201).json(toClientJSON({ message: 'Success', order: fullOrder }))
})

// Client uploads proof of payment for their own pending order
uploadProof = asyncHandler(async(req,res)=>{
    const order = await Order.findByPk(req.params.id)
    if (!order){ res.status(404); throw new Error('Order not found') }
    if (String(order.orderById) !== String(req.user._id) && !req.user.isAdmin){
        res.status(403); throw new Error('Not your order')
    }
    if (!req.file){ res.status(400); throw new Error('No file uploaded') }
    await order.update({
        proofOfPayment: `/uploads/proofs/${req.file.filename}`,
        orderStatus: 'Processing',
        paymentStatus: 'Proof Submitted',
    })
    res.status(200).json(toClientJSON(order))
})

getOrders = asyncHandler(async(req,res)=>{
    const { status, search, page: pageQ, limit: limitQ } = req.query
    const where = {}
    if (status) where.orderStatus = status
    if (search) {
        where[Op.or] = [
            { paymentIntentId: { [Op.like]: `%${search}%` } },
            { contact: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
        ]
    }

    const include = [
        { model: OrderItem, as: 'products' },
        { model: User, as: 'orderby', attributes: ['id', 'username', 'email', 'phone'] },
    ]

    if (!pageQ && !limitQ) {
        const orders = await Order.findAll({ where, include, order: [['createdAt', 'DESC']] })
        return res.json(toClientJSON(orders))
    }

    const { page, limit, offset } = getPagination(req.query, 10)
    const result = await Order.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit, offset, distinct: true })
    res.json(toClientJSON(buildPageResult(result, page, limit)))
})

getOrder = asyncHandler(async(req,res)=>{
    const order = await Order.findByPk(req.params.id, {
        include: [
            { model: OrderItem, as: 'products' },
            { model: User, as: 'orderby', attributes: ['id', 'username', 'email', 'phone'] },
        ],
    })
    res.json(toClientJSON(order))
})

getUserOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id
    const orders = await Order.findAll({
        where: { orderById: userId },
        include: [{ model: OrderItem, as: 'products' }],
        order: [['createdAt', 'DESC']],
    })
    res.json(toClientJSON(orders))
})

// Client cancels their own order (only while it's not yet dispatched)
cancelOrder = asyncHandler(async(req,res)=>{
    const order = await Order.findByPk(req.params.id)
    if (!order){ res.status(404); throw new Error('Order not found') }
    if (String(order.orderById) !== String(req.user._id) && !req.user.isAdmin){
        res.status(403); throw new Error('Not your order')
    }
    if (['Dispatched','Delivered'].includes(order.orderStatus)){
        res.status(400); throw new Error('This order can no longer be cancelled')
    }
    await order.update({ orderStatus: 'Cancelled' })
    res.json(toClientJSON(order))
})

deleteOrder = asyncHandler(async(req,res)=>{
    const order = await Order.findByPk(req.params.id)
    await order?.destroy()
    res.json({ msg: 'successfully deleted', userOrderAvailable: toClientJSON(order) })
})

updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body
    const order = await Order.findByPk(req.params.id)
    if (!order){ res.status(404); throw new Error('Order not found') }
    await order.update({ orderStatus: status, paymentStatus: status })
    res.json(toClientJSON(order))
})

module.exports = { createOrder, uploadProof, getOrders, getOrder, getUserOrders, cancelOrder, deleteOrder, updateOrderStatus }
