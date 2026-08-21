// Lightweight, reversible obfuscation for public-facing product URLs so raw
// sequential database IDs ("/product/1", "/product/2"...) aren't exposed
// directly in the address bar.
// NOTE: this is obfuscation, not cryptographic security - it just keeps
// incremental IDs from being guessable/enumerable by visitors.
const MOD = 4294967296n // 2^32
const MULT = 2654435761n // Knuth's multiplicative hash constant (odd, coprime with 2^32)
const MULT_INV = 244002641n // modular inverse of MULT mod 2^32
const XOR_KEY = 92617n

const encodeId = (id) => {
    const n = BigInt(id)
    if (n < 0n) return null
    const scrambled = ((n * MULT) % MOD) ^ XOR_KEY
    return Buffer.from(scrambled.toString()).toString('base64url')
}

const decodeId = (hash) => {
    try {
        const scrambled = BigInt(Buffer.from(hash, 'base64url').toString('utf8'))
        const unxored = scrambled ^ XOR_KEY
        const n = (unxored * MULT_INV) % MOD
        return Number(n)
    } catch (e) {
        return null
    }
}

module.exports = { encodeId, decodeId }
