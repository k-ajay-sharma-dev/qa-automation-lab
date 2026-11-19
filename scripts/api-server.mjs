// ShopEasy practice REST API — the system under test for the "API Testing (RestAssured)" section.
// Zero dependencies (node:http only). Start it with:   npm run api      (http://localhost:5181)
// All data lives in memory and is reset to the same deterministic seed on every start and on POST /api/reset.
//
// Conventions
//   * JSON in, JSON out (Content-Type: application/json; charset=utf-8). CORS is open (*).
//   * Errors always look like:  { "error": { "code": "PRODUCT_NOT_FOUND", "message": "...", "details": [...]? } }
//   * Auth: POST /api/auth/login returns a token; send it as  Authorization: Bearer <token>
//   * Users: standard_user / secret_sauce (id 1), locked_out_user / secret_sauce (id 2, always 403 on login),
//            visual_user / secret_sauce (id 3, a second customer for "someone else's order" tests)
//   * Tax is 8% of the subtotal, rounded to 2 decimals (same as the ShopEasy web shop).
//
// Endpoints
//   GET    /api/health                  200 { status: "UP", service, version }
//   POST   /api/reset                   200 { status: "RESET" }  — restores the seed data, drops tokens/carts/orders
//   POST   /api/auth/login              body { username, password }
//                                       200 { token, tokenType: "Bearer", expiresIn: 3600, user: { id, username } }
//                                       400 VALIDATION_FAILED (missing field) · 401 INVALID_CREDENTIALS · 403 USER_LOCKED
//   GET    /api/products                query: q (name contains, case-insensitive), sort (name_asc|name_desc|price_asc|
//                                       price_desc, aliases az|za|lohi|hilo), page (1-based, default 1), size (1–50, default 10)
//                                       200 { data: [product], page, size, total, totalPages } · 400 INVALID_QUERY
//   GET    /api/products/{id}           200 product · 400 INVALID_ID · 404 PRODUCT_NOT_FOUND
//   GET    /api/schema/product          200 JSON Schema (draft-07) describing one product
//   GET    /api/cart                    auth · 200 { userId, items: [{ productId, name, price, quantity, lineTotal }], itemCount, subtotal }
//   POST   /api/cart/items              auth · body { productId, quantity? = 1 } · 201 cart
//                                       404 PRODUCT_NOT_FOUND · 409 ITEM_ALREADY_IN_CART · 422 INVALID_QUANTITY
//   DELETE /api/cart/items/{productId}  auth · 204 · 404 ITEM_NOT_IN_CART
//   DELETE /api/cart                    auth · 204 (empties the cart)
//   POST   /api/orders                  auth · body { firstName, lastName, postalCode, items?: [{ productId, quantity }] }
//                                       (no items → the current cart is ordered and then emptied)
//                                       201 order (+ Location: /api/orders/{id}) · 400 VALIDATION_FAILED with details
//                                       [{ field, message }] · 404 PRODUCT_NOT_FOUND · 422 EMPTY_CART
//                                       order = { id, userId, status: "PLACED", customer: { firstName, lastName, postalCode },
//                                                 items: [...], itemCount, subtotal, tax, total, createdAt }
//   GET    /api/orders                  auth · 200 { data: [order] } (the caller's orders)
//   GET    /api/orders/{id}             auth · 200 order · 403 FORBIDDEN (another user's order) · 404 ORDER_NOT_FOUND
//   GET    /api/users/{id}              200 { id, username, firstName, lastName, email, phone, roles, address: { street, city,
//                                       postalCode, country } } · 404 USER_NOT_FOUND
//   PUT    /api/users/{id}              auth (own user) · full replace of firstName, lastName, email, phone, address
//                                       200 user · 400 VALIDATION_FAILED · 403 FORBIDDEN · 422 INVALID_EMAIL
//   PATCH  /api/users/{id}              auth (own user) · partial update (address fields are merged)
//                                       200 user · 403 FORBIDDEN · 422 INVALID_EMAIL | READ_ONLY_FIELD
//   POST   /api/users                   register a customer (no auth) · body { username, password, firstName, lastName, email,
//                                       phone?, address? } · username 3–40 of [a-z0-9_.-], password ≥ 8 chars
//                                       201 user (+ Location: /api/users/{id}) · 400 VALIDATION_FAILED · 409 USERNAME_TAKEN
//                                       · 422 INVALID_EMAIL. Registered users log in with their own password; reset removes them.
//   POST   /api/users/{id}/avatar       auth (own user) · multipart/form-data with a part "file" (image/png or image/jpeg,
//                                       1 byte–100 KB) and an optional text part "altText" (≤ 120 chars)
//                                       201 { userId, fileName, contentType, sizeBytes, altText, uploadedAt, url } (+ Location)
//                                       400 VALIDATION_FAILED | INVALID_MULTIPART · 403 FORBIDDEN · 413 PAYLOAD_TOO_LARGE
//                                       · 415 UNSUPPORTED_MEDIA_TYPE (body not multipart, or file part not png/jpeg)
//   GET    /api/users/{id}/avatar       200 avatar metadata · 404 USER_NOT_FOUND | AVATAR_NOT_FOUND
//   DELETE /api/users/{id}/avatar       auth (own user) · 204 · 404 AVATAR_NOT_FOUND
//   GET    /api/slow?ms=2000            waits ms (0–10000) then 200 { delayedMs } — for response-time / timeout practice
//   Anything else                       404 ROUTE_NOT_FOUND · wrong method 405 METHOD_NOT_ALLOWED · bad JSON 400 INVALID_JSON
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT) || 5181
const TAX_RATE = 0.08
const PASSWORD = 'secret_sauce'

const SEED_PRODUCTS = [
  { id: 1, slug: 'trailblazer-backpack', name: 'Trailblazer Backpack', price: 29.99, category: 'bags', stock: 25, description: 'Water-resistant 22L daypack with a padded laptop sleeve.' },
  { id: 2, slug: 'pulse-bike-light', name: 'Pulse Bike Light', price: 9.99, category: 'accessories', stock: 40, description: 'USB-rechargeable front light with three flash modes.' },
  { id: 3, slug: 'classic-crew-t-shirt', name: 'Classic Crew T-Shirt', price: 15.99, category: 'clothing', stock: 60, description: 'Soft cotton crew-neck tee that survives 100 washes.' },
  { id: 4, slug: 'storm-fleece-jacket', name: 'Storm Fleece Jacket', price: 49.99, category: 'clothing', stock: 12, description: 'Mid-weight fleece with a wind-blocking chest panel.' },
  { id: 5, slug: 'junior-onesie', name: 'Junior Onesie', price: 7.99, category: 'kids', stock: 30, description: 'Organic cotton onesie with easy snap buttons.' },
  { id: 6, slug: 'retro-red-tee', name: 'Retro Red Tee', price: 15.99, category: 'clothing', stock: 0, description: 'Vintage-wash red tee with a 70s ShopEasy logo.' },
]

const SEED_USERS = [
  { id: 1, username: 'standard_user', locked: false, firstName: 'Asha', lastName: 'Rao', email: 'asha.rao@shopeasy.test', phone: '+91-80-5550-0101', roles: ['CUSTOMER'], address: { street: '12 MG Road', city: 'Bengaluru', postalCode: '560001', country: 'IN' } },
  { id: 2, username: 'locked_out_user', locked: true, firstName: 'Lars', lastName: 'Lock', email: 'lars.lock@shopeasy.test', phone: '+46-8-5550-0202', roles: ['CUSTOMER'], address: { street: '4 Drottninggatan', city: 'Stockholm', postalCode: '11151', country: 'SE' } },
  { id: 3, username: 'visual_user', locked: false, firstName: 'Vera', lastName: 'Visual', email: 'vera.visual@shopeasy.test', phone: '+1-415-555-0303', roles: ['CUSTOMER'], address: { street: '500 Market St', city: 'San Francisco', postalCode: '94105', country: 'US' } },
]

// Draft-04 on purpose: RestAssured's json-schema-validator module (java-json-tools) supports draft-04,
// so this file can be saved as-is to src/test/resources/schemas/product-schema.json.
const PRODUCT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  id: 'http://localhost:5181/api/schema/product',
  title: 'Product',
  type: 'object',
  required: ['id', 'slug', 'name', 'price', 'category', 'stock', 'inStock', 'description'],
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
    slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
    name: { type: 'string', minLength: 1 },
    price: { type: 'number', minimum: 0, exclusiveMinimum: true },
    category: { type: 'string', enum: ['bags', 'accessories', 'clothing', 'kids'] },
    stock: { type: 'integer', minimum: 0 },
    inStock: { type: 'boolean' },
    description: { type: 'string' },
  },
}

let db
function reset() {
  db = {
    products: SEED_PRODUCTS.map((p) => ({ ...p })),
    users: SEED_USERS.map((u) => ({ ...u, roles: [...u.roles], address: { ...u.address } })),
    tokens: new Map(), // token -> userId
    tokenSeq: 0,
    carts: new Map(), // userId -> [{ productId, quantity }]
    orders: new Map(), // id -> order
    orderSeq: 1000,
    avatars: new Map(), // userId -> avatar metadata
  }
}
reset()

// ---------- helpers
const round2 = (n) => Math.round(n * 100) / 100
const productView = (p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, category: p.category, stock: p.stock, inStock: p.stock > 0, description: p.description })
const userView = (u) => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, roles: [...u.roles], address: { ...u.address } })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class HttpError extends Error {
  constructor(status, code, message, details, headers) {
    super(message)
    Object.assign(this, { status, code, details, headers })
  }
}
const err = (status, code, message, details, headers) => new HttpError(status, code, message, details, headers)

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Expose-Headers': 'Location, X-Request-Id',
    ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    ...headers,
  })
  res.end(body === undefined ? undefined : JSON.stringify(body, null, 2))
}

async function readJson(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return parsed
  } catch {
    throw err(400, 'INVALID_JSON', 'Request body must be a JSON object')
  }
}

function auth(req) {
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(\S+)$/i.exec(h)
  const userId = m && db.tokens.get(m[1])
  if (!userId) {
    throw err(401, 'UNAUTHORIZED', h ? 'Bearer token is invalid or expired' : 'Authorization header with a Bearer token is required', undefined, { 'WWW-Authenticate': 'Bearer realm="shopeasy"' })
  }
  return db.users.find((u) => u.id === userId)
}

function parseId(raw, what = 'id') {
  if (!/^\d+$/.test(raw)) throw err(400, 'INVALID_ID', `${what} must be a positive integer, got "${raw}"`)
  return Number(raw)
}

function findProduct(id) {
  const p = db.products.find((x) => x.id === id)
  if (!p) throw err(404, 'PRODUCT_NOT_FOUND', `Product ${id} not found`)
  return p
}

function cartView(userId) {
  const items = (db.carts.get(userId) || []).map((i) => {
    const p = findProduct(i.productId)
    return { productId: p.id, name: p.name, price: p.price, quantity: i.quantity, lineTotal: round2(p.price * i.quantity) }
  })
  return { userId, items, itemCount: items.reduce((n, i) => n + i.quantity, 0), subtotal: round2(items.reduce((s, i) => s + i.lineTotal, 0)) }
}

function validQuantity(q) {
  return Number.isInteger(q) && q >= 1 && q <= 10
}

// ---------- route handlers
const SORTS = {
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
  price_asc: (a, b) => a.price - b.price || a.id - b.id,
  price_desc: (a, b) => b.price - a.price || a.id - b.id,
}
const SORT_ALIASES = { az: 'name_asc', za: 'name_desc', lohi: 'price_asc', hilo: 'price_desc' }

function listProducts(url) {
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const sortRaw = url.searchParams.get('sort')
  const details = []
  const intParam = (name, def, min, max) => {
    const raw = url.searchParams.get(name)
    if (raw === null || raw === '') return def
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min || n > max) details.push({ field: name, message: `${name} must be an integer between ${min} and ${max}` })
    return n
  }
  const page = intParam('page', 1, 1, 1000)
  const size = intParam('size', 10, 1, 50)
  let sortKey = null
  if (sortRaw) {
    sortKey = SORT_ALIASES[sortRaw] || sortRaw
    if (!SORTS[sortKey]) details.push({ field: 'sort', message: `sort must be one of ${Object.keys(SORTS).join(', ')} (or az, za, lohi, hilo)` })
  }
  if (details.length) throw err(400, 'INVALID_QUERY', 'One or more query parameters are invalid', details)
  let list = db.products.filter((p) => !q || p.name.toLowerCase().includes(q))
  if (sortKey) list = [...list].sort(SORTS[sortKey])
  const total = list.length
  return { data: list.slice((page - 1) * size, page * size).map(productView), page, size, total, totalPages: Math.ceil(total / size) }
}

function validateCustomer(body) {
  const details = []
  for (const f of ['firstName', 'lastName', 'postalCode']) {
    const v = body[f]
    if (typeof v !== 'string' || !v.trim()) details.push({ field: f, message: `${f} is required` })
  }
  if (typeof body.postalCode === 'string' && body.postalCode.trim() && !/^[A-Za-z0-9 -]{3,10}$/.test(body.postalCode.trim())) {
    details.push({ field: 'postalCode', message: 'postalCode must be 3-10 letters, digits, spaces or dashes' })
  }
  if (details.length) throw err(400, 'VALIDATION_FAILED', 'Order request is invalid', details)
}

function placeOrder(user, body) {
  validateCustomer(body)
  let lines
  let fromCart = false
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) throw err(400, 'VALIDATION_FAILED', 'Order request is invalid', [{ field: 'items', message: 'items must be an array' }])
    lines = body.items.map((i, idx) => {
      const quantity = i?.quantity === undefined ? 1 : i.quantity
      if (!Number.isInteger(i?.productId)) throw err(400, 'VALIDATION_FAILED', 'Order request is invalid', [{ field: `items[${idx}].productId`, message: 'productId must be an integer' }])
      if (!validQuantity(quantity)) throw err(422, 'INVALID_QUANTITY', `items[${idx}].quantity must be an integer between 1 and 10`)
      return { productId: i.productId, quantity }
    })
  } else {
    lines = db.carts.get(user.id) || []
    fromCart = true
  }
  if (!lines.length) throw err(422, 'EMPTY_CART', 'Cannot place an order with no items')
  const items = lines.map((l) => {
    const p = findProduct(l.productId)
    return { productId: p.id, name: p.name, price: p.price, quantity: l.quantity, lineTotal: round2(p.price * l.quantity) }
  })
  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0))
  const tax = round2(subtotal * TAX_RATE)
  const order = {
    id: ++db.orderSeq,
    userId: user.id,
    status: 'PLACED',
    customer: { firstName: body.firstName.trim(), lastName: body.lastName.trim(), postalCode: body.postalCode.trim() },
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    tax,
    total: round2(subtotal + tax),
    createdAt: new Date().toISOString(),
  }
  db.orders.set(order.id, order)
  if (fromCart) db.carts.delete(user.id)
  return order
}

const USER_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'address']
const ADDRESS_FIELDS = ['street', 'city', 'postalCode', 'country']
const READ_ONLY = ['id', 'username', 'roles']

function targetUser(req, rawId) {
  const id = parseId(rawId)
  const target = db.users.find((u) => u.id === id)
  if (!target) throw err(404, 'USER_NOT_FOUND', `User ${id} not found`)
  return target
}

function updateUser(req, rawId, body, full) {
  const me = auth(req)
  const target = targetUser(req, rawId)
  if (me.id !== target.id) throw err(403, 'FORBIDDEN', 'You can only update your own profile')
  const ro = READ_ONLY.filter((f) => f in body && JSON.stringify(body[f]) !== JSON.stringify(target[f]))
  if (ro.length) throw err(422, 'READ_ONLY_FIELD', `Field(s) cannot be changed: ${ro.join(', ')}`, ro.map((f) => ({ field: f, message: `${f} is read-only` })))
  const details = []
  if (full) {
    for (const f of USER_FIELDS) if (body[f] === undefined || body[f] === null || body[f] === '') details.push({ field: f, message: `${f} is required for PUT` })
    if (body.address && typeof body.address === 'object') {
      for (const f of ADDRESS_FIELDS) if (!body.address[f]) details.push({ field: `address.${f}`, message: `address.${f} is required for PUT` })
    }
  }
  for (const f of ['firstName', 'lastName', 'email', 'phone']) if (f in body && typeof body[f] !== 'string') details.push({ field: f, message: `${f} must be a string` })
  if ('address' in body && (typeof body.address !== 'object' || body.address === null || Array.isArray(body.address))) details.push({ field: 'address', message: 'address must be an object' })
  if (details.length) throw err(400, 'VALIDATION_FAILED', 'User update is invalid', details)
  if ('email' in body && !EMAIL_RE.test(body.email)) throw err(422, 'INVALID_EMAIL', `"${body.email}" is not a valid email address`, [{ field: 'email', message: 'must be a valid email address' }])
  for (const f of ['firstName', 'lastName', 'email', 'phone']) if (f in body) target[f] = body[f]
  if (body.address) {
    const next = full ? {} : { ...target.address }
    for (const f of ADDRESS_FIELDS) if (f in body.address) next[f] = String(body.address[f])
    target.address = next
  }
  return userView(target)
}

function registerUser(body) {
  const details = []
  if (typeof body.username !== 'string' || !/^[a-z0-9_.-]{3,40}$/.test(body.username)) {
    details.push({ field: 'username', message: 'username must be 3-40 characters of a-z, 0-9, _ . -' })
  }
  if (typeof body.password !== 'string' || body.password.length < 8) details.push({ field: 'password', message: 'password must be at least 8 characters' })
  for (const f of ['firstName', 'lastName', 'email']) {
    if (typeof body[f] !== 'string' || !body[f].trim()) details.push({ field: f, message: `${f} is required` })
  }
  if ('phone' in body && typeof body.phone !== 'string') details.push({ field: 'phone', message: 'phone must be a string' })
  if ('address' in body && (typeof body.address !== 'object' || body.address === null || Array.isArray(body.address))) details.push({ field: 'address', message: 'address must be an object' })
  if (details.length) throw err(400, 'VALIDATION_FAILED', 'Registration request is invalid', details)
  if (!EMAIL_RE.test(body.email)) throw err(422, 'INVALID_EMAIL', `"${body.email}" is not a valid email address`, [{ field: 'email', message: 'must be a valid email address' }])
  if (db.users.some((u) => u.username === body.username)) throw err(409, 'USERNAME_TAKEN', `Username "${body.username}" is already registered`)
  const address = {}
  for (const f of ADDRESS_FIELDS) address[f] = body.address && body.address[f] !== undefined ? String(body.address[f]) : ''
  const user = {
    id: Math.max(...db.users.map((u) => u.id)) + 1,
    username: body.username,
    password: body.password,
    locked: false,
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email: body.email,
    phone: body.phone || '',
    roles: ['CUSTOMER'],
    address,
  }
  db.users.push(user)
  return userView(user)
}

const MAX_AVATAR_BYTES = 100 * 1024
const MAX_UPLOAD_REQUEST = 2 * 1024 * 1024
const AVATAR_TYPES = ['image/png', 'image/jpeg']

async function readRaw(req, limit) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size <= limit) chunks.push(c)
  }
  if (size > limit) throw err(413, 'PAYLOAD_TOO_LARGE', `Request body must not exceed ${limit} bytes`)
  return Buffer.concat(chunks)
}

// Minimal multipart/form-data parser (enough for RestAssured, curl and Postman uploads).
function parseMultipart(buf, boundary) {
  const delim = Buffer.from(`--${boundary}`)
  const parts = []
  let pos = buf.indexOf(delim)
  if (pos === -1) return null
  for (;;) {
    pos += delim.length
    if (buf[pos] === 45 && buf[pos + 1] === 45) return parts // closing "--"
    if (buf[pos] === 13 && buf[pos + 1] === 10) pos += 2
    const next = buf.indexOf(delim, pos)
    if (next === -1) return null
    let part = buf.subarray(pos, next)
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) part = part.subarray(0, part.length - 2)
    const sep = part.indexOf('\r\n\r\n')
    if (sep === -1) return null
    const headers = {}
    for (const line of part.subarray(0, sep).toString('utf8').split('\r\n')) {
      const i = line.indexOf(':')
      if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
    }
    const cd = headers['content-disposition'] || ''
    const name = /\bname="([^"]*)"/i.exec(cd)?.[1]
    const filename = /\bfilename="([^"]*)"/i.exec(cd)?.[1]
    const contentType = (headers['content-type'] || (filename !== undefined ? 'application/octet-stream' : 'text/plain')).split(';')[0].trim().toLowerCase()
    parts.push({ name, filename, contentType, data: part.subarray(sep + 4) })
    pos = next
  }
}

async function uploadAvatar(req, rawId) {
  const me = auth(req)
  const target = targetUser(req, rawId)
  if (me.id !== target.id) throw err(403, 'FORBIDDEN', 'You can only change your own avatar')
  const ct = req.headers['content-type'] || ''
  if (!/^multipart\/form-data/i.test(ct)) {
    throw err(415, 'UNSUPPORTED_MEDIA_TYPE', `Avatar upload must be multipart/form-data, got "${ct || 'no Content-Type'}"`)
  }
  const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct)
  if (!bm) throw err(400, 'INVALID_MULTIPART', 'multipart/form-data request has no boundary')
  const parts = parseMultipart(await readRaw(req, MAX_UPLOAD_REQUEST), (bm[1] || bm[2]).trim())
  if (!parts) throw err(400, 'INVALID_MULTIPART', 'Could not parse the multipart body')
  const file = parts.find((p) => p.name === 'file')
  const alt = parts.find((p) => p.name === 'altText')
  const details = []
  if (!file || file.filename === undefined) details.push({ field: 'file', message: 'a file part named "file" is required' })
  else if (!file.data.length) details.push({ field: 'file', message: 'file must not be empty' })
  const altText = alt ? alt.data.toString('utf8') : null
  if (altText !== null && altText.length > 120) details.push({ field: 'altText', message: 'altText must be at most 120 characters' })
  if (details.length) throw err(400, 'VALIDATION_FAILED', 'Avatar upload is invalid', details)
  if (!AVATAR_TYPES.includes(file.contentType)) {
    throw err(415, 'UNSUPPORTED_MEDIA_TYPE', `Avatar must be image/png or image/jpeg, got ${file.contentType}`, [{ field: 'file', message: `unsupported type ${file.contentType}` }])
  }
  if (file.data.length > MAX_AVATAR_BYTES) {
    throw err(413, 'PAYLOAD_TOO_LARGE', `Avatar must be at most ${MAX_AVATAR_BYTES} bytes, got ${file.data.length}`, [{ field: 'file', message: 'at most 100 KB' }])
  }
  const avatar = {
    userId: target.id,
    fileName: file.filename,
    contentType: file.contentType,
    sizeBytes: file.data.length,
    altText,
    uploadedAt: new Date().toISOString(),
    url: `/api/users/${target.id}/avatar`,
  }
  db.avatars.set(target.id, avatar)
  return avatar
}

async function route(req, res, url) {
  const { pathname } = url
  const m = req.method
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean) // ['api', 'products', '3']
  if (parts[0] !== 'api') throw err(404, 'ROUTE_NOT_FOUND', `No route for ${m} ${pathname}`)
  const [, resource, a, b] = parts
  const methodNotAllowed = (allowed) => err(405, 'METHOD_NOT_ALLOWED', `${m} is not supported on ${pathname}`, undefined, { Allow: allowed })

  switch (resource) {
    case 'health':
      if (parts.length !== 2) break
      if (m !== 'GET') throw methodNotAllowed('GET')
      return send(res, 200, { status: 'UP', service: 'shopeasy-api', version: '1.0.0' })

    case 'reset':
      if (parts.length !== 2) break
      if (m !== 'POST') throw methodNotAllowed('POST')
      reset()
      return send(res, 200, { status: 'RESET' })

    case 'auth':
      if (a !== 'login' || parts.length !== 3) break
      if (m !== 'POST') throw methodNotAllowed('POST')
      {
        const body = await readJson(req)
        const details = ['username', 'password'].filter((f) => typeof body[f] !== 'string' || !body[f]).map((f) => ({ field: f, message: `${f} is required` }))
        if (details.length) throw err(400, 'VALIDATION_FAILED', 'username and password are required', details)
        const user = db.users.find((u) => u.username === body.username)
        if (!user || body.password !== (user.password ?? PASSWORD)) throw err(401, 'INVALID_CREDENTIALS', 'Username and password do not match any user in this service')
        if (user.locked) throw err(403, 'USER_LOCKED', 'Sorry, this user has been locked out.')
        const token = `se_${user.id}_${(++db.tokenSeq).toString().padStart(4, '0')}_${Buffer.from(user.username).toString('hex').slice(0, 12)}`
        db.tokens.set(token, user.id)
        return send(res, 200, { token, tokenType: 'Bearer', expiresIn: 3600, user: { id: user.id, username: user.username } })
      }

    case 'products':
      if (parts.length === 2) {
        if (m !== 'GET') throw methodNotAllowed('GET')
        return send(res, 200, listProducts(url))
      }
      if (parts.length === 3) {
        if (m !== 'GET') throw methodNotAllowed('GET')
        return send(res, 200, productView(findProduct(parseId(a))))
      }
      break

    case 'schema':
      if (a !== 'product' || parts.length !== 3) break
      if (m !== 'GET') throw methodNotAllowed('GET')
      return send(res, 200, PRODUCT_SCHEMA, { 'Content-Type': 'application/schema+json; charset=utf-8' })

    case 'cart': {
      if (parts.length === 2) {
        if (m === 'GET') return send(res, 200, cartView(auth(req).id))
        if (m === 'DELETE') {
          db.carts.delete(auth(req).id)
          return send(res, 204)
        }
        if (m === 'POST') return addToCart(req, res) // alias of POST /api/cart/items
        throw methodNotAllowed('GET, POST, DELETE')
      }
      if (a !== 'items') break
      if (parts.length === 3) {
        if (m !== 'POST') throw methodNotAllowed('POST')
        return addToCart(req, res)
      }
      if (parts.length === 4) {
        if (m !== 'DELETE') throw methodNotAllowed('DELETE')
        const user = auth(req)
        const pid = parseId(b, 'productId')
        const cart = db.carts.get(user.id) || []
        if (!cart.some((i) => i.productId === pid)) throw err(404, 'ITEM_NOT_IN_CART', `Product ${pid} is not in the cart`)
        db.carts.set(user.id, cart.filter((i) => i.productId !== pid))
        return send(res, 204)
      }
      break
    }

    case 'orders':
      if (parts.length === 2) {
        if (m === 'POST') {
          const user = auth(req)
          const order = placeOrder(user, await readJson(req))
          return send(res, 201, order, { Location: `/api/orders/${order.id}` })
        }
        if (m === 'GET') {
          const user = auth(req)
          return send(res, 200, { data: [...db.orders.values()].filter((o) => o.userId === user.id) })
        }
        throw methodNotAllowed('GET, POST')
      }
      if (parts.length === 3) {
        if (m !== 'GET') throw methodNotAllowed('GET')
        const user = auth(req)
        const id = parseId(a)
        const order = db.orders.get(id)
        if (!order) throw err(404, 'ORDER_NOT_FOUND', `Order ${id} not found`)
        if (order.userId !== user.id) throw err(403, 'FORBIDDEN', 'This order belongs to another customer')
        return send(res, 200, order)
      }
      break

    case 'users':
      if (parts.length === 2 && m === 'POST') {
        const created = registerUser(await readJson(req))
        return send(res, 201, created, { Location: `/api/users/${created.id}` })
      }
      if (parts.length === 4 && b === 'avatar') {
        if (m === 'GET') {
          const target = targetUser(req, a)
          const avatar = db.avatars.get(target.id)
          if (!avatar) throw err(404, 'AVATAR_NOT_FOUND', `User ${target.id} has no avatar`)
          return send(res, 200, avatar)
        }
        if (m === 'POST') {
          const avatar = await uploadAvatar(req, a)
          return send(res, 201, avatar, { Location: avatar.url })
        }
        if (m === 'DELETE') {
          const me = auth(req)
          const target = targetUser(req, a)
          if (me.id !== target.id) throw err(403, 'FORBIDDEN', 'You can only change your own avatar')
          if (!db.avatars.has(target.id)) throw err(404, 'AVATAR_NOT_FOUND', `User ${target.id} has no avatar`)
          db.avatars.delete(target.id)
          return send(res, 204)
        }
        throw methodNotAllowed('GET, POST, DELETE')
      }
      if (parts.length !== 3) break
      if (m === 'GET') return send(res, 200, userView(targetUser(req, a)))
      if (m === 'PUT' || m === 'PATCH') return send(res, 200, updateUser(req, a, await readJson(req), m === 'PUT'))
      throw methodNotAllowed('GET, PUT, PATCH')

    case 'slow': {
      if (parts.length !== 2) break
      if (m !== 'GET') throw methodNotAllowed('GET')
      const raw = url.searchParams.get('ms') ?? '2000'
      const ms = Number(raw)
      if (!Number.isInteger(ms) || ms < 0 || ms > 10000) throw err(400, 'INVALID_QUERY', 'ms must be an integer between 0 and 10000', [{ field: 'ms', message: 'between 0 and 10000' }])
      await new Promise((r) => setTimeout(r, ms))
      return send(res, 200, { delayedMs: ms })
    }
  }
  throw err(404, 'ROUTE_NOT_FOUND', `No route for ${m} ${pathname}`)
}

async function addToCart(req, res) {
  const user = auth(req)
  const body = await readJson(req)
  if (!Number.isInteger(body.productId)) throw err(400, 'VALIDATION_FAILED', 'productId is required', [{ field: 'productId', message: 'productId must be an integer' }])
  const quantity = body.quantity === undefined ? 1 : body.quantity
  if (!validQuantity(quantity)) throw err(422, 'INVALID_QUANTITY', 'quantity must be an integer between 1 and 10', [{ field: 'quantity', message: 'between 1 and 10' }])
  const p = findProduct(body.productId)
  if (p.stock === 0) throw err(422, 'OUT_OF_STOCK', `${p.name} is out of stock`)
  const cart = db.carts.get(user.id) || []
  if (cart.some((i) => i.productId === p.id)) throw err(409, 'ITEM_ALREADY_IN_CART', `${p.name} is already in the cart`)
  db.carts.set(user.id, [...cart, { productId: p.id, quantity }])
  return send(res, 201, cartView(user.id))
}

let requestSeq = 0
const server = createServer(async (req, res) => {
  const started = Date.now()
  const reqId = `req-${String(++requestSeq).padStart(5, '0')}`
  res.setHeader('X-Request-Id', reqId)
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  try {
    if (req.method === 'OPTIONS') send(res, 204)
    else await route(req, res, url)
  } catch (e) {
    if (e instanceof HttpError) {
      send(res, e.status, { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } }, e.headers)
    } else {
      console.error(e)
      send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } })
    }
  }
  console.log(`${new Date().toISOString().slice(11, 19)} ${req.method.padEnd(6)} ${url.pathname}${url.search} -> ${res.statusCode} (${Date.now() - started} ms)`)
})

server.listen(PORT, () => {
  console.log(`ShopEasy practice API running on http://localhost:${PORT}/api  (try GET /api/health)`)
})
