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
    name: localStorage.getItem('slimora_product_name') || 'Slimora Sweat Belt',
    price: localStorage.getItem('slimora_product_price') || '399',
    description: localStorage.getItem('slimora_product_desc') || 'Premium waist trimmer for effective fat burning',
    image: localStorage.getItem('slimora_product_image') || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80'
  };
}

// ===== COUNTDOWN TIMER =====
function initCountdown() {
  const endKey = 'slimora_timer_end';
  let endTime = localStorage.getItem(endKey);
  if (!endTime || Date.now() > parseInt(endTime)) {
    endTime = Date.now() + (3 * 60 * 60 * 1000); // 3 hours
    localStorage.setItem(endKey, endTime);
  }
  function tick() {
    const diff = parseInt(endTime) - Date.now();
    if (diff <= 0) {
      localStorage.removeItem(endKey);
      location.reload();
      return;
    }
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

// ===== PINCODE LOOKUP =====
async function fetchPincode(pin) {
  const loader = document.querySelector('.pincode-loader');
  const cityEl = document.getElementById('city');
  const stateEl = document.getElementById('state');
  const pinMsg = document.getElementById('pin-msg');
  if (loader) loader.classList.add('active');
  if (pinMsg) { pinMsg.className = 'field-msg'; pinMsg.textContent = ''; }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
      const po = data[0].PostOffice[0];
      if (cityEl) { cityEl.value = po.District; }
      if (stateEl) { stateEl.value = po.State; }
      if (pinMsg) { pinMsg.className = 'field-msg success'; pinMsg.textContent = `✓ ${po.Name}, ${po.District}, ${po.State}`; }
      document.getElementById('pincode').classList.add('success');
      document.getElementById('pincode').classList.remove('error');
    } else {
      if (cityEl) cityEl.value = '';
      if (stateEl) stateEl.value = '';
      if (pinMsg) { pinMsg.className = 'field-msg error'; pinMsg.textContent = '✗ Invalid pincode. Please check.'; }
      document.getElementById('pincode').classList.add('error');
      document.getElementById('pincode').classList.remove('success');
    }
  } catch (e) {
    if (pinMsg) { pinMsg.className = 'field-msg error'; pinMsg.textContent = 'Network error. Enter city/state manually.'; }
    if (cityEl) cityEl.removeAttribute('readonly');
    if (stateEl) stateEl.removeAttribute('readonly');
  } finally {
    if (loader) loader.classList.remove('active');
  }
}

// ===== ORDER FORM =====
function initOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;

  // Auto-restore saved draft
  const draft = JSON.parse(localStorage.getItem('slimora_draft') || '{}');
  ['name', 'phone', 'pincode', 'address', 'city', 'state'].forEach(f => {
    const el = document.getElementById(f);
    if (el && draft[f]) el.value = draft[f];
  });

  // Auto-save draft on input
  form.addEventListener('input', () => {
    const d = {};
    ['name', 'phone', 'pincode', 'address', 'city', 'state'].forEach(f => {
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

  // Phone validation
  const phoneEl = document.getElementById('phone');
  if (phoneEl) {
    phoneEl.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  // Submit
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Placing Order...';

    const product = getProductData();
    const order = {
      id: 'SLM' + Date.now(),
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      pincode: document.getElementById('pincode').value.trim(),
      address: document.getElementById('address').value.trim(),
      city: document.getElementById('city').value.trim(),
      state: document.getElementById('state').value.trim(),
      product: product.name,
      price: product.price,
      timestamp: new Date().toLocaleString('en-IN'),
      status: 'Pending'
    };

    // Save to localStorage
    const orders = JSON.parse(localStorage.getItem('slimora_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('slimora_orders', JSON.stringify(orders));
    localStorage.removeItem('slimora_draft');

    // Fire Pixel event
    if (window.fbq) {
      fbq('track', 'Purchase', {
        value: parseFloat(product.price),
        currency: 'INR',
        content_name: product.name
      });
    }

    // Show success
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '🛒 Order Now - COD';
      showSuccessModal(order.id);
      form.reset();
    }, 1200);
  });
}

function validateForm() {
  let valid = true;
  const fields = [
    { id: 'name', min: 2, label: 'Name' },
    { id: 'phone', min: 10, label: 'Phone' },
    { id: 'pincode', min: 6, label: 'Pincode' },
    { id: 'address', min: 8, label: 'Address' },
    { id: 'city', min: 1, label: 'City' },
    { id: 'state', min: 1, label: 'State' }
  ];
  fields.forEach(({ id, min, label }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value.trim();
    if (val.length < min) {
      el.classList.add('error');
      el.classList.remove('success');
      valid = false;
    } else {
      el.classList.remove('error');
      el.classList.add('success');
    }
  });
  const phone = document.getElementById('phone');
  if (phone && !/^[6-9]\d{9}$/.test(phone.value.trim())) {
    phone.classList.add('error');
    valid = false;
  }
  if (!valid) {
    const firstErr = document.querySelector('.form-control.error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    fbq('track', 'InitiateCheckout', {
      value: parseFloat(product.price),
      currency: 'INR',
      content_name: product.name
    });
  }
  document.getElementById('order-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('name')?.focus();
}

// ===== LOAD PRODUCT DATA INTO PAGE =====
function loadProductData() {
  const p = getProductData();
  const els = {
    'product-name': p.name,
    'product-price': '₹' + p.price,
    'order-product-name': p.name,
    'order-product-price': '₹' + p.price
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
  if (!sticky) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
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

  // Close modal
  document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('success-modal')?.classList.remove('active');
  });

  // All "Order Now" CTAs
  document.querySelectorAll('.order-now-btn').forEach(btn => {
    btn.addEventListener('click', onOrderClick);
  });
});
