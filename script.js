// ===== SLIMORA - SCRIPT.JS =====

// ===== META PIXEL =====
function initPixel() {
  const pixelId = localStorage.getItem('slimora_pixel_id');
  if (!pixelId) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', pixelId);
  fbq('track', 'PageView');
}
initPixel();

// ===== PRODUCT DATA =====
function getProductData() {
  return {
    name:        localStorage.getItem('slimora_product_name')  || 'Slimora Sweat Belt',
    price:       localStorage.getItem('slimora_product_price') || '399',
    description: localStorage.getItem('slimora_product_desc')  || 'Premium waist trimmer for effective fat burning',
    image:       localStorage.getItem('slimora_product_image') || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80'
  };
}

// ===== COUNTDOWN TIMER =====
function initCountdown() {
  const endKey = 'slimora_timer_end';
  let endTime = localStorage.getItem(endKey);
  if (!endTime || Date.now() > parseInt(endTime)) {
    endTime = Date.now() + (3 * 60 * 60 * 1000);
    localStorage.setItem(endKey, endTime);
  }
  function tick() {
    const diff = parseInt(endTime) - Date.now();
    if (diff <= 0) { localStorage.removeItem(endKey); location.reload(); return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = id => document.getElementById(id);
    if (el('timer-h')) el('timer-h').textContent = String(h).padStart(2, '0');
    if (el('timer-m')) el('timer-m').textContent = String(m).padStart(2, '0');
    if (el('timer-s')) el('timer-s').textContent = String(s).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
}

// ===== GOOGLE SHEETS CONFIG =====
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwl0ef96Mp41VsLuMPtoe3_be26vvdJYwwW9ZCZ2NJjeRk0Swu6mysVfIRywI2P1tt_ng/exec';

// Retry queue — orders that failed to sync get retried on next page load
function getRetryQueue() { return JSON.parse(localStorage.getItem('slimora_retry_queue') || '[]'); }
function setRetryQueue(q) { localStorage.setItem('slimora_retry_queue', JSON.stringify(q)); }

/*
  WHY THREE METHODS:
  ─────────────────
  GAS Web Apps are deployed behind Google's redirect infrastructure.
  • fetch() POST with Content-Type: application/json → triggers CORS preflight → GAS blocks it
  • fetch() POST with Content-Type: text/plain       → no preflight → GAS receives it via e.postData.contents
  • fetch() GET  with mode: no-cors                  → opaque response, can't read it, but GAS doGet() fires
  • <form> POST submit via hidden iframe             → completely bypasses CORS, 100% reliable for GAS

  We try all three in order. The iframe form approach (Method 3) is the nuclear option that
  always works because it's a real browser form submission, not an XHR/fetch at all.
*/
async function saveOrderToSheets(order) {

  // ── Method 1: POST text/plain (no preflight, GAS reads via e.postData.contents) ──
  try {
    const res = await fetch(SHEETS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(order)
    });
    if (res.ok || res.status === 302) {
      console.log('✅ Sheets synced via POST text/plain');
      return;
    }
  } catch (e1) {
    console.warn('Method 1 (POST) failed:', e1.message);
  }

  // ── Method 2: GET with URL params + no-cors (opaque but GAS doGet() fires) ──
  try {
    const params = new URLSearchParams(flattenOrder(order));
    await fetch(`${SHEETS_URL}?${params.toString()}`, {
      method: 'GET',
      mode:   'no-cors'
    });
    console.log('✅ Sheets sync fired via GET no-cors (opaque — check your sheet)');
    return;
  } catch (e2) {
    console.warn('Method 2 (GET no-cors) failed:', e2.message);
  }

  // ── Method 3: Hidden <form> POST via invisible iframe (bypasses CORS entirely) ──
  try {
    await submitViaHiddenForm(order);
    console.log('✅ Sheets sync fired via hidden form POST');
    return;
  } catch (e3) {
    console.warn('Method 3 (hidden form) failed:', e3.message);
    throw new Error('All three Sheets sync methods failed');
  }
}

function flattenOrder(order) {
  return {
    orderId:   order.id,
    name:      order.name,
    phone:     order.phone,
    pincode:   order.pincode,
    address:   order.address,
    city:      order.city,
    state:     order.state,
    product:   order.product,
    price:     order.price,
    timestamp: order.timestamp,
    status:    order.status
  };
}

function submitViaHiddenForm(order) {
  return new Promise((resolve, reject) => {
    try {
      // Create a hidden iframe to catch the response (avoids page navigation)
      const iframe = document.createElement('iframe');
      iframe.name = 'sheets_iframe_' + Date.now();
      iframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;left:-9999px';
      document.body.appendChild(iframe);

      // Build hidden form targeting the iframe
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = SHEETS_URL;
      form.target = iframe.name;
      form.style.display = 'none';

      const fields = flattenOrder(order);
      Object.entries(fields).forEach(([key, val]) => {
        const input = document.createElement('input');
        input.type  = 'hidden';
        input.name  = key;
        input.value = val || '';
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      // Clean up after 5 s — by then GAS has received the submission
      setTimeout(() => {
        try { document.body.removeChild(form);   } catch(_) {}
        try { document.body.removeChild(iframe); } catch(_) {}
        resolve();
      }, 5000);
    } catch (err) {
      reject(err);
    }
  });
}

// Retry unsynced orders from previous sessions
async function retryPendingSyncs() {
  const queue = getRetryQueue();
  if (!queue.length) return;
  console.log(`🔄 Retrying ${queue.length} unsynced order(s)…`);
  const stillFailed = [];
  for (const order of queue) {
    try { await saveOrderToSheets(order); }
    catch { stillFailed.push(order); }
  }
  setRetryQueue(stillFailed);
  if (!stillFailed.length) console.log('✅ All pending orders now synced to Sheets.');
}

// ===== PINCODE LOOKUP =====
async function fetchPincode(pin) {
  const loader  = document.querySelector('.pincode-loader');
  const cityEl  = document.getElementById('city');
  const stateEl = document.getElementById('state');
  const pinMsg  = document.getElementById('pin-msg');
  if (loader)  loader.classList.add('active');
  if (pinMsg) { pinMsg.className = 'field-msg'; pinMsg.textContent = ''; }
  try {
    const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      if (cityEl)  cityEl.value  = po.District;
      if (stateEl) stateEl.value = po.State;
      if (pinMsg) { pinMsg.className = 'field-msg success'; pinMsg.textContent = `✓ ${po.Name}, ${po.District}, ${po.State}`; }
      document.getElementById('pincode').classList.add('success');
      document.getElementById('pincode').classList.remove('error');
    } else {
      if (cityEl)  cityEl.value  = '';
      if (stateEl) stateEl.value = '';
      if (pinMsg) { pinMsg.className = 'field-msg error'; pinMsg.textContent = '✗ Invalid pincode. Please check.'; }
      document.getElementById('pincode').classList.add('error');
      document.getElementById('pincode').classList.remove('success');
    }
  } catch (e) {
    if (pinMsg) { pinMsg.className = 'field-msg error'; pinMsg.textContent = 'Network error. Enter city/state manually.'; }
    if (cityEl)  cityEl.removeAttribute('readonly');
    if (stateEl) stateEl.removeAttribute('readonly');
  } finally {
    if (loader) loader.classList.remove('active');
  }
}

// ===== ORDER FORM =====
function initOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;

  // Restore draft
  const draft = JSON.parse(localStorage.getItem('slimora_draft') || '{}');
  ['name','phone','pincode','address','city','state'].forEach(f => {
    const el = document.getElementById(f);
    if (el && draft[f]) el.value = draft[f];
  });

  // Auto-save draft
  form.addEventListener('input', () => {
    const d = {};
    ['name','phone','pincode','address','city','state'].forEach(f => {
      const el = document.getElementById(f);
      if (el) d[f] = el.value;
    });
    localStorage.setItem('slimora_draft', JSON.stringify(d));
  });

  // Pincode auto-fetch
  const pinEl = document.getElementById('pincode');
  if (pinEl) {
    pinEl.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 6);
      if (this.value.length === 6) fetchPincode(this.value);
    });
  }

  // Phone digits only
  const phoneEl = document.getElementById('phone');
  if (phoneEl) {
    phoneEl.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  // ── SUBMIT ──
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Saving Order...';

    const product = getProductData();
    const order = {
      id:        'SLM' + Date.now(),
      name:      document.getElementById('name').value.trim(),
      phone:     document.getElementById('phone').value.trim(),
      pincode:   document.getElementById('pincode').value.trim(),
      address:   document.getElementById('address').value.trim(),
      city:      document.getElementById('city').value.trim(),
      state:     document.getElementById('state').value.trim(),
      product:   product.name,
      price:     product.price,
      timestamp: new Date().toLocaleString('en-IN'),
      status:    'Pending'
    };

    // 1️⃣ Save to localStorage FIRST (instant, never fails)
    const orders = JSON.parse(localStorage.getItem('slimora_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('slimora_orders', JSON.stringify(orders));
    localStorage.removeItem('slimora_draft');

    // 2️⃣ Show success immediately — don't make user wait for network
    btn.disabled = false;
    btn.innerHTML = '🛒 Order Now - COD';
    showSuccessModal(order.id);
    form.reset();
    form.querySelectorAll('.form-control').forEach(el => el.classList.remove('success','error'));

    // 3️⃣ Sync to Google Sheets in background (non-blocking)
    saveOrderToSheets(order)
      .then(() => console.log('📊 Order', order.id, 'synced to Google Sheets'))
      .catch(err => {
        console.warn('📊 Sheets sync failed, queued for retry:', err.message);
        const q = getRetryQueue();
        q.push(order);
        setRetryQueue(q);
      });

    // 4️⃣ Fire Meta Pixel
    if (window.fbq) {
      fbq('track', 'Purchase', {
        value:        parseFloat(product.price),
        currency:     'INR',
        content_name: product.name
      });
    }
  });
}

function validateForm() {
  let valid = true;
  const fields = [
    { id: 'name',    min: 2  },
    { id: 'phone',   min: 10 },
    { id: 'pincode', min: 6  },
    { id: 'address', min: 8  },
    { id: 'city',    min: 1  },
    { id: 'state',   min: 1  }
  ];
  fields.forEach(({ id, min }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.value.trim().length < min) {
      el.classList.add('error'); el.classList.remove('success'); valid = false;
    } else {
      el.classList.remove('error'); el.classList.add('success');
    }
  });
  const phone = document.getElementById('phone');
  if (phone && !/^[6-9]\d{9}$/.test(phone.value.trim())) {
    phone.classList.add('error'); valid = false;
  }
  if (!valid) {
    document.querySelector('.form-control.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

function showSuccessModal(orderId) {
  const modal = document.getElementById('success-modal');
  const oidEl = document.getElementById('modal-order-id');
  if (modal) modal.classList.add('active');
  if (oidEl) oidEl.textContent = orderId;
}

// ===== INITIATE CHECKOUT PIXEL EVENT =====
function onOrderClick() {
  if (window.fbq) {
    const product = getProductData();
    fbq('track', 'InitiateCheckout', { value: parseFloat(product.price), currency: 'INR', content_name: product.name });
  }
  document.getElementById('order-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('name')?.focus();
}

// ===== LOAD PRODUCT DATA INTO PAGE =====
function loadProductData() {
  const p = getProductData();
  const els = {
    'product-name':       p.name,
    'product-price':      '₹' + p.price,
    'order-product-name': p.name,
    'order-product-price':'₹' + p.price
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
  const heroImg = document.getElementById('hero-img');
  if (heroImg && p.image) heroImg.src = p.image;
}

// ===== STICKY CTA SCROLL =====
function initStickyCTA() {
  const sticky = document.getElementById('sticky-cta');
  const hero   = document.querySelector('.hero');
  if (!sticky || !hero) return;
  const observer = new IntersectionObserver(([e]) => {
    sticky.style.display = e.isIntersecting ? 'none' : 'block';
  }, { threshold: 0 });
  observer.observe(hero);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadProductData();
  initCountdown();
  initOrderForm();
  initStickyCTA();
  retryPendingSyncs(); // retry any orders that failed to sync last time

  document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('success-modal')?.classList.remove('active');
  });

  document.querySelectorAll('.order-now-btn').forEach(btn => {
    btn.addEventListener('click', onOrderClick);
  });
});
