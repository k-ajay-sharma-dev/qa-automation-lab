// ShopEasy shared shop logic (catalogue, cart in sessionStorage, badge, logout).
// Used by inventory.html, cart.html and checkout.html.
var ShopEasy = (function () {
  var PRODUCTS = [
    { slug: 'trailblazer-backpack', name: 'Trailblazer Backpack', price: 29.99, icon: '🎒', desc: 'Water-resistant 22L daypack with a padded laptop sleeve.' },
    { slug: 'pulse-bike-light', name: 'Pulse Bike Light', price: 9.99, icon: '🔦', desc: 'USB-rechargeable front light with three flash modes.' },
    { slug: 'classic-crew-t-shirt', name: 'Classic Crew T-Shirt', price: 15.99, icon: '👕', desc: 'Soft cotton crew-neck tee that survives 100 washes.' },
    { slug: 'storm-fleece-jacket', name: 'Storm Fleece Jacket', price: 49.99, icon: '🧥', desc: 'Mid-weight fleece with a wind-blocking chest panel.' },
    { slug: 'junior-onesie', name: 'Junior Onesie', price: 7.99, icon: '👶', desc: 'Organic cotton onesie with easy snap buttons.' },
    { slug: 'retro-red-tee', name: 'Retro Red Tee', price: 15.99, icon: '🎽', desc: 'Vintage-wash red tee with a 70s ShopEasy logo.' },
  ]
  var CART_KEY = 'shopeasy.cart'
  var USER_KEY = 'shopeasy.user'
  var TAX_RATE = 0.08

  function safeGet(store, key) {
    try { return window[store].getItem(key) } catch (e) { return null }
  }
  function safeSet(store, key, value) {
    try { window[store].setItem(key, value) } catch (e) { /* storage blocked */ }
  }
  function safeRemove(store, key) {
    try { window[store].removeItem(key) } catch (e) { /* storage blocked */ }
  }

  function product(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i]
    return null
  }
  function getCart() {
    try { return JSON.parse(safeGet('sessionStorage', CART_KEY) || '[]') } catch (e) { return [] }
  }
  function setCart(items) {
    safeSet('sessionStorage', CART_KEY, JSON.stringify(items))
    updateBadge()
  }
  function addToCart(slug) {
    var c = getCart()
    if (c.indexOf(slug) === -1) c.push(slug)
    setCart(c)
  }
  function removeFromCart(slug) {
    setCart(getCart().filter(function (s) { return s !== slug }))
  }
  // Inside the app's Locator Lab iframe there is no login and no cart, so show sample items
  // (never persisted) to keep cart/checkout pages useful to inspect.
  var DEMO_CART = ['trailblazer-backpack', 'pulse-bike-light']
  function inFrame() {
    try { return window.self !== window.top } catch (e) { return true }
  }
  function displayCart() {
    var c = getCart()
    return c.length === 0 && inFrame() ? DEMO_CART.slice() : c
  }
  function inCart(slug) { return getCart().indexOf(slug) !== -1 }
  function clearCart() { safeRemove('sessionStorage', CART_KEY); updateBadge() }

  function updateBadge() {
    var link = document.getElementById('shopping-cart-link')
    if (!link) return
    var count = getCart().length
    var badge = link.querySelector('.shopping-cart-badge')
    if (count === 0) {
      if (badge) badge.remove()
      return
    }
    if (!badge) {
      badge = document.createElement('span')
      badge.className = 'shopping-cart-badge'
      badge.setAttribute('data-testid', 'shopping-cart-badge')
      link.appendChild(badge)
    }
    badge.textContent = String(count)
  }

  function currentUser() { return safeGet('sessionStorage', USER_KEY) }
  function login(user) { safeSet('sessionStorage', USER_KEY, user) }
  function logout() {
    safeRemove('sessionStorage', USER_KEY)
    clearCart()
    window.location.href = 'login.html'
  }

  function money(n) { return '$' + n.toFixed(2) }

  function initHeader() {
    updateBadge()
    var out = document.getElementById('logout-link')
    if (out) out.addEventListener('click', function (e) { e.preventDefault(); logout() })
    var who = document.getElementById('logged-in-user')
    if (who) who.textContent = currentUser() || 'guest'
    var notice = document.getElementById('guest-notice')
    if (notice && !currentUser()) notice.classList.remove('hidden')
  }

  return {
    PRODUCTS: PRODUCTS, TAX_RATE: TAX_RATE, product: product, getCart: getCart, addToCart: addToCart,
    removeFromCart: removeFromCart, displayCart: displayCart, inFrame: inFrame, inCart: inCart, clearCart: clearCart, updateBadge: updateBadge,
    currentUser: currentUser, login: login, logout: logout, money: money, initHeader: initHeader,
  }
})()
