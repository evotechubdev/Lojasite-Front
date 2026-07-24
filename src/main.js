import './style.css';
import { icon } from './icons.js';

const DEFAULT_API = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://lojasite-back.onrender.com';
const API = (import.meta.env.VITE_API_URL || DEFAULT_API).replace(/\/$/, '');
let systemConfig;
const pathSegments = location.pathname.split('/').filter(Boolean);
const repositoryBase = String(import.meta.env.BASE_URL || '/').split('/').filter(Boolean)[0]?.toLowerCase();
const slug = (pathSegments[0]?.toLowerCase() === repositoryBase ? pathSegments[1] : pathSegments[0])?.toLowerCase() || '';
const state = { store: null, cart: JSON.parse(localStorage.getItem(`cart:${slug}`) || '{}'), token: sessionStorage.getItem(`token:${slug}`) || '', user: JSON.parse(sessionStorage.getItem(`user:${slug}`) || 'null'), category: 'Todos', query: '', productsExpanded: false, productCarouselTimer: null };
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escapeHtml = value => { const el = document.createElement('span'); el.textContent = String(value ?? ''); return el.innerHTML; };

async function loadSystemConfig() {
  const response = await fetch(`${import.meta.env.BASE_URL}config-pub-sistema.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Arquivo público de configuração do sistema não encontrado.');
  const config = await response.json();
  if (typeof config.nome_sistema !== 'string' || !config.nome_sistema.trim() || typeof config.slogan !== 'string' || !config.slogan.trim()) {
    throw new Error('Arquivo público de configuração do sistema inválido.');
  }
  if (!Array.isArray(config.planos) || config.planos.length !== 3 || config.planos.some(plan => typeof plan?.nome !== 'string' || !plan.nome.trim() || !Number.isFinite(plan.valor_mensal) || plan.valor_mensal <= 0 || !Array.isArray(plan.beneficios) || !plan.beneficios.length || plan.beneficios.some(item => typeof item !== 'string' || !item.trim()))) {
    throw new Error('Os três planos públicos não estão configurados corretamente.');
  }
  systemConfig = {
    name: config.nome_sistema.trim().slice(0, 80),
    slogan: config.slogan.trim().slice(0, 160),
    plans: config.planos.map(plan => ({
      name: plan.nome.trim().slice(0, 60),
      monthlyPrice: Number(plan.valor_mensal),
      recommended: plan.recomendado === true,
      startingAt: plan.a_partir_de === true,
      stars: Math.min(5, Math.max(1, Number(plan.estrelas) || 1)),
      benefits: plan.beneficios.map(item => item.trim().slice(0, 180))
    }))
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
  return data;
}
function saveCart() { localStorage.setItem(`cart:${slug}`, JSON.stringify(state.cart)); updateCartBadge(); }
function cartItems() { return state.store.products.filter(p => state.cart[p.id]).map(p => ({ ...p, quantity: state.cart[p.id] })); }
function total() { return cartItems().reduce((sum, item) => sum + item.price * item.quantity, 0); }
function toast(message, type='ok') { const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; $('#toast-root').append(el); setTimeout(() => el.remove(), 3200); }

function productCard(product) {
  const description=String(product.description||'');
  const descriptionElement=description.length>90?`<button class="product-description expandable" data-product-description="${escapeHtml(product.id)}" type="button" aria-label="Ler descrição completa de ${escapeHtml(product.name)}">${escapeHtml(description)}</button>`:`<p class="product-description">${escapeHtml(description)}</p>`;
  const whatsappIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8.2 7.8c.3-.4.6-.4.9-.1l1.1 2c.2.4 0 .7-.4 1.1-.2.2.8 2 2.7 2.8.5.2.8-.6 1.2-1 .2-.2.5-.2.8 0l1.8 1.1c.4.2.4.6.3.9-.5 1.2-1.4 1.8-2.7 1.7-3.5-.3-7-3.5-7.2-6.7-.1-.8.5-1.5 1.5-1.8Z"/></svg>';
  const hasDiscount=Number(product.oldPrice)>Number(product.price);
  const discount=hasDiscount?Math.round((1-Number(product.price)/Number(product.oldPrice))*100):0;
  const priceBlock=`<div class="product-price${hasDiscount?' discounted':''}">${hasDiscount?`<span class="discount-badge">-${discount}%</span>`:''}<strong>${money(product.price)}</strong>${hasDiscount?`<s>${money(product.oldPrice)}</s>`:''}</div>`;
  return `<article class="product-card"><div class="product-art" style="--art:${product.color}"><span class="product-tag">${escapeHtml(product.category)}</span>${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">` : icon(product.icon, 72)}</div><div class="product-info"><h3>${escapeHtml(product.name)}</h3>${descriptionElement}<div class="product-buy"><div class="product-actions"><button class="request-purchase" data-request-purchase="${product.id}" type="button">${whatsappIcon}<span>Solicitar Compra</span></button><button class="add" data-add="${product.id}" aria-label="Adicionar ${escapeHtml(product.name)}">${icon('bag',20)}<span>Adicionar</span></button></div>${priceBlock}</div></div></article>`;
}
function renderProducts() {
  clearInterval(state.productCarouselTimer);
  const products = state.store.products.filter(p => (state.category === 'Todos' || p.category === state.category) && `${p.name} ${p.description}`.toLowerCase().includes(state.query.toLowerCase()));
  const verticalCarousel = matchMedia('(max-width: 600px)').matches;
  const initialProductLimit = matchMedia('(max-width: 900px)').matches ? 2 : 3;
  const visibleProducts = verticalCarousel || state.productsExpanded ? products : products.slice(0, initialProductLimit);
  $('#products').classList.toggle('expanded', state.productsExpanded);
  $('#products').innerHTML = visibleProducts.length ? visibleProducts.map(productCard).join('') : '<div class="empty"><h3>Nenhum produto encontrado</h3><p>Tente outro termo ou categoria.</p></div>';
  const moreButton = $('#more-products');
  if (moreButton) {
    moreButton.hidden = verticalCarousel || products.length <= initialProductLimit;
    moreButton.textContent = state.productsExpanded ? 'Menos Produtos' : `Mais Produtos (${products.length - initialProductLimit})`;
    moreButton.setAttribute('aria-expanded', String(state.productsExpanded));
  }
  document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => {
    if (!state.user) return openLogin();
    if (state.user.role !== 'cliente') return toast('Use uma conta de cliente para comprar.', 'error');
    state.cart[btn.dataset.add] = (state.cart[btn.dataset.add] || 0) + 1;
    saveCart(); toast('Produto adicionado ao carrinho.'); btn.classList.add('added');
    setTimeout(() => btn.classList.remove('added'), 500);
  });
  document.querySelectorAll('[data-product-description]').forEach(button=>button.onclick=()=>{const product=state.store.products.find(item=>item.id===button.dataset.productDescription);if(product)openProductDescription(product);});
  document.querySelectorAll('[data-request-purchase]').forEach(button=>button.onclick=()=>{const product=state.store.products.find(item=>item.id===button.dataset.requestPurchase);if(product)openPurchaseRequest(product);});
  if(verticalCarousel)requestAnimationFrame(startProductCarousel);
}
function renderSearchSuggestions(value) {
  const panel = $('#search-suggestions');
  if (!panel) return;
  const term = String(value || '').trim().toLowerCase();
  const suggestions = term ? state.store.products.filter(product => `${product.name} ${product.category} ${product.description || ''} ${product.barcode || ''}`.toLowerCase().includes(term)).slice(0, 6) : [];
  panel.innerHTML = suggestions.map(product => `<button type="button" data-suggestion="${escapeHtml(product.id)}">${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="">` : `<span class="suggestion-placeholder">${icon(product.icon, 22)}</span>`}<span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${money(product.price)}</small></span></button>`).join('');
  panel.hidden = !suggestions.length;
  panel.querySelectorAll('[data-suggestion]').forEach(button => button.onclick = () => {
    const product = state.store.products.find(item => item.id === button.dataset.suggestion);
    if (!product) return;
    state.query = product.name;
    $('#header-search').value = product.name;
    panel.hidden = true;
    renderProducts();
    document.querySelector('[data-store-section="produtos"]')?.click();
  });
}
function startProductCarousel(){
  const carousel=$('#products');
  const controls=$('#product-carousel-controls');
  if(!carousel)return;
  const hasOverflow=carousel.scrollHeight>carousel.clientHeight+2;
  if(controls)controls.hidden=!hasOverflow;
  if(!hasOverflow)return;
  const move=direction=>{const firstCard=carousel.querySelector('.product-card');const step=(firstCard?.offsetHeight||280)+8;const atEnd=carousel.scrollTop+carousel.clientHeight>=carousel.scrollHeight-8;const atStart=carousel.scrollTop<=8;carousel.scrollTo({top:direction>0?(atEnd?0:carousel.scrollTop+step):(atStart?carousel.scrollHeight:carousel.scrollTop-step),behavior:'smooth'});};
  const start=()=>{clearInterval(state.productCarouselTimer);state.productCarouselTimer=setInterval(()=>{if(!carousel.isConnected)return clearInterval(state.productCarouselTimer);move(1);},3200);};
  const pause=()=>clearInterval(state.productCarouselTimer);
  $('#previous-product')?.addEventListener('click',()=>{pause();move(-1);start();});
  $('#next-product')?.addEventListener('click',()=>{pause();move(1);start();});
  carousel.addEventListener('mouseenter',pause);carousel.addEventListener('mouseleave',start);carousel.addEventListener('touchstart',pause,{passive:true});carousel.addEventListener('touchend',start,{passive:true});
  start();
}
function openProductDescription(product){modal(`<span class="kicker">${escapeHtml(product.category)}</span><h2>${escapeHtml(product.name)}</h2><div class="description-content">${escapeHtml(product.description)}</div>`,'description-modal');}
function openPurchaseRequest(product){
  const store=state.store;
  const overlay=document.createElement('div');
  overlay.className='mini-modal-overlay purchase-popup-overlay';
  overlay.innerHTML=`<section class="mini-modal purchase-popup" role="alertdialog" aria-modal="true" aria-labelledby="purchase-popup-title"><button class="mini-modal-close close" type="button" aria-label="Fechar">×</button><span class="kicker">SOLICITAÇÃO PELO WHATSAPP</span><h3 id="purchase-popup-title">Solicitar compra</h3><p>Deseja solicitar a compra de <strong>${escapeHtml(product.name)}</strong> pelo WhatsApp da loja <strong>${escapeHtml(store.name)}</strong>?</p><div class="purchase-confirm-actions"><button class="secondary" data-cancel-purchase type="button">Cancelar</button><button class="purchase-confirm" data-confirm-purchase type="button">Solicitar</button></div></section>`;
  $('#modal-root').append(overlay);
  const closePopup=()=>overlay.remove();
  overlay.querySelector('.mini-modal-close').onclick=closePopup;
  overlay.querySelector('[data-cancel-purchase]').onclick=closePopup;
  overlay.onclick=event=>{if(event.target===overlay)closePopup();};
  overlay.querySelector('[data-confirm-purchase]').onclick=()=>{
    const whatsapp=String(store.publicInfo?.whatsappOs||'').replace(/\D/g,'');
    if(!whatsapp)return toast('O WhatsApp de ordem de serviço desta loja não está configurado.','error');
    const message=`Olá! Gostaria de solicitar a compra do produto "${product.name}" (${money(product.price)}) na loja ${store.name}.`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
    closePopup();
  };
}
function updateCartBadge() { const count = Object.values(state.cart).reduce((a,b) => a+b, 0); const el = $('#cart-count'); if (el) { el.textContent = count; el.hidden = count === 0; } }
function renderApp() {
  const store = state.store; document.title = `${store.name} · Loja online`; document.documentElement.style.setProperty('--primary', store.theme.primary); document.documentElement.style.setProperty('--accent', store.theme.accent);
  const staff = state.user && ['admin', 'gerente', 'supervisor', 'operador'].includes(state.user.role);
  const manager = state.user && ['admin', 'gerente'].includes(state.user.role);
  const userInitial = escapeHtml(state.user?.name?.trim()?.[0]?.toUpperCase() || 'U');
  const userAvatar = state.user?.photoUrl ? `<img src="${escapeHtml(state.user.photoUrl)}" alt="Foto de ${escapeHtml(state.user.name)}" data-user-photo>` : `<span>${userInitial}</span>`;
  const categories = ['Todos', ...new Set(store.products.map(p => p.category))];
  const featuredProducts = store.products.slice(0, 2);
  const heroVisual = featuredProducts.length
    ? `<div class="hero-visual"><div class="orb one"></div><div class="orb two"></div>${featuredProducts[1] ? `<div class="hero-card back">${icon(featuredProducts[1].icon,94)}</div>` : ''}<div class="hero-card front">${icon(featuredProducts[0].icon,120)}<small>A partir de</small><strong>${money(featuredProducts[0].price)}</strong></div></div>`
    : `<div class="hero-visual"><div class="orb one"></div><div class="orb two"></div><div class="hero-card front empty-hero-card"><strong>Catálogo em preparação</strong><small>Novos produtos serão publicados em breve.</small></div></div>`;
  const info = store.publicInfo || {};
  const zipCode = String(info.addressZipCode || '').replace(/\D/g, '');
  const formattedZipCode = zipCode.length === 8 ? `${zipCode.slice(0, 5)}-${zipCode.slice(5)}` : zipCode;
  const address = info.address || [
    [info.addressStreet, info.addressNumber].filter(Boolean).join(', '),
    info.addressComplement,
    [info.addressCity, info.addressState].filter(Boolean).join(' - '),
    formattedZipCode ? `CEP ${formattedZipCode}` : ''
  ].filter(Boolean).join(' · ');
  const generatedMapUrl = address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : '';
  const contactWhatsappIcon='<svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.47 14.86L2 22l5.27-1.53A9.96 9.96 0 1 0 12.04 2Zm0 17.99a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.13.91.91-3.05-.2-.31a8.01 8.01 0 1 1 6.85 3.76Zm4.45-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21a7.31 7.31 0 0 1-1.35-1.68c-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.31-.75-1.8-.2-.47-.4-.41-.55-.42h-.46c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg>';
  const contactMailIcon='<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
  const contactItems = `<div class="store-hours"><b>Horário de funcionamento</b><span>${escapeHtml(info.hours || 'Consulte a loja')}</span><div class="store-contact-actions"><b>Contatos</b><div class="contact-icons">${info.whatsapp ? `<a class="contact-whatsapp" href="https://wa.me/${escapeHtml(info.whatsapp)}" target="_blank" rel="noopener" aria-label="Abrir WhatsApp" title="WhatsApp">${contactWhatsappIcon}</a>` : ''}${info.email ? `<a class="contact-email" href="mailto:${escapeHtml(info.email)}" aria-label="Enviar e-mail" title="E-mail">${contactMailIcon}</a>` : ''}</div></div></div>`;
  $('#app').innerHTML = `<header class="header store-header"><a class="logo store-logo store-logo-only" href="${import.meta.env.BASE_URL}${slug}" aria-label="${escapeHtml(store.name)}"><img id="store-logo-image" src="${import.meta.env.BASE_URL}imagens_org/${store.id}/logo.png" alt="Logo ${escapeHtml(store.name)}"></a><div class="store-header-center"><nav class="store-nav" aria-label="Seções da loja"><a href="#produtos" data-store-section="produtos">PRODUTOS</a><a href="#novidades" data-store-section="novidades">NOVIDADES</a><a href="#nossa-loja" data-store-section="nossa-loja">NOSSA LOJA</a></nav></div><div class="header-actions"><button class="cart-button" id="cart" aria-label="Abrir carrinho">${icon('bag',22)}<span>Carrinho</span><b id="cart-count" hidden>0</b></button>${state.user ? `<div class="user-menu-wrap"><button class="logged-user" id="user-menu-button" aria-label="Abrir menu de ${escapeHtml(state.user.name)}" aria-expanded="false"><span class="user-avatar">${userAvatar}</span><span class="logged-user-name">${escapeHtml(state.user.name)}</span><b>⋮</b></button><nav class="user-menu" id="user-menu" hidden><strong>${escapeHtml(state.user.name)}</strong><small>${escapeHtml(state.user.cargo || '')}</small>${staff ? `<button data-corporate="stock">Estoque</button>${manager ? `<button data-corporate="payments">Sistema de Pagamento</button><button data-corporate="access">Gestão de Logins</button>` : ''}` : `<button id="account">Dados Cadastrais</button><button id="payment-data">Dados de Pagamento</button><button id="orders-menu">Minhas Compras</button>`}<button id="logout-menu">Sair</button></nav></div>` : `<button class="login-button" id="login">Entrar</button>`}</div></header>
  <main><section class="catalog store-page-section" id="produtos"><div class="section-head"><div><span class="kicker">PRODUTOS</span><h2 class="aligned-product-title"><span>Produtos</span><span>em</span><span>destaque</span></h2><div class="catalog-search"><div class="header-search-wrap"><label class="header-search">⌕<input id="header-search" value="${escapeHtml(state.query)}" autocomplete="off" placeholder="Pesquisar produtos" aria-label="Pesquisar produtos" aria-controls="search-suggestions"></label><div class="search-suggestions" id="search-suggestions" hidden></div></div></div></div><button class="more-products" id="more-products" type="button" aria-expanded="false">Mais Produtos</button></div><div class="catalog-browser"><aside class="category-panel"><div class="category-navigation" aria-label="Categorias">${categories.map(category=>`<button data-category="${escapeHtml(category)}" class="${state.category===category?'active':''}">${category==='Todos'?'TODAS AS CATEGORIAS':escapeHtml(category)}</button>`).join('')}</div></aside><div class="product-grid" id="products"></div><div class="product-carousel-controls" id="product-carousel-controls" hidden><button id="previous-product" type="button" aria-label="Produto anterior">↑</button><span>Deslize ou navegue pelos produtos</span><button id="next-product" type="button" aria-label="Próximo produto">↓</button></div></div></section>
  <section class="hero store-page-section" id="novidades"><div class="hero-copy"><span class="kicker">NOVIDADES</span><h1>${escapeHtml(store.tagline)}</h1><p>Escolhas especiais, compra segura e entrega para todo o Brasil.</p><a href="#produtos" data-store-section="produtos">Ver produtos <span>↗</span></a></div>${heroVisual}</section>
  <section class="store-about store-page-section" id="nossa-loja"><div class="store-about-copy"><span class="kicker">NOSSA LOJA</span><h2>${escapeHtml(store.name)}</h2><button class="store-description" id="store-description" type="button">${escapeHtml(info.description || store.tagline)}<span>...mais</span></button><div class="store-contacts">${contactItems}</div></div><div class="store-map-column"><div class="store-map">${info.mapUrl || generatedMapUrl ? `<iframe src="${escapeHtml(info.mapUrl || generatedMapUrl)}" title="Mapa de ${escapeHtml(store.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div><strong>Mapa em preparação</strong><span>O endereço desta loja será publicado em breve.</span></div>'}</div></div><footer class="portal-simple-footer organization-footer"><button class="footer-system-logo" id="lojasite-footer-logo" type="button" aria-label="Conhecer o portal ${escapeHtml(systemConfig.name)}"><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo ${escapeHtml(systemConfig.name)}"></button><button class="footer-developer" id="developer-contact" type="button" aria-label="Abrir contatos de suporte da EVOTECHUB"><img src="${import.meta.env.BASE_URL}imagens_pub/logo_dev.png" alt="Logo EVOTECHUB"><span>© EVOTECHUB 2026 - Todos os direitos reservados.</span></button></footer></section></main>`;
  updateCartBadge(); renderProducts();
  const logoImage = $('#store-logo-image'); logoImage.onerror = () => { if (!logoImage.dataset.jpgTried) { logoImage.dataset.jpgTried = 'true'; logoImage.src = `${import.meta.env.BASE_URL}imagens_org/${store.id}/logo.jpg`; return; } logoImage.hidden = true; };
  const userPhoto = $('[data-user-photo]'); if (userPhoto) userPhoto.onerror = () => { userPhoto.parentElement.innerHTML = `<span>${userInitial}</span>`; };
  $('#login')?.addEventListener('click', () => openLogin()); $('#account')?.addEventListener('click', openAccount); $('#payment-data')?.addEventListener('click', openPaymentData); $('#orders-menu')?.addEventListener('click', showOrders); $('#cart').onclick = openCart; $('#header-search').oninput = e => { state.query = e.target.value; state.productsExpanded = false; renderProducts(); renderSearchSuggestions(e.target.value); };
  $('#header-search').onkeydown = event => { if (event.key === 'Escape') $('#search-suggestions').hidden = true; };
  $('#more-products').onclick = () => { state.productsExpanded = !state.productsExpanded; renderProducts(); };
  const userMenu = $('#user-menu');
  const setUserMenu = open => { if (!userMenu) return; userMenu.hidden = !open; $('#user-menu-button')?.setAttribute('aria-expanded', String(open)); };
  if (userMenu) { const close = document.createElement('button'); close.type = 'button'; close.className = 'user-menu-close'; close.setAttribute('aria-label', 'Fechar menu'); close.textContent = '×'; close.onclick = () => setUserMenu(false); const profile = document.createElement('button'); profile.type = 'button'; profile.className = 'menu-profile-avatar'; profile.setAttribute('aria-label', 'Alterar foto do perfil'); profile.innerHTML = userAvatar; profile.onclick = () => { setUserMenu(false); openAccount(); }; const header = document.createElement('div'); header.className = 'user-menu-header'; header.append(close, profile, userMenu.querySelector(':scope > strong'), userMenu.querySelector(':scope > small')); userMenu.prepend(header); }
  $('#user-menu-button')?.addEventListener('click', () => setUserMenu(userMenu.hidden));
  document.querySelectorAll('[data-corporate]').forEach(button => button.onclick = () => { setUserMenu(false); openCorporate(button.dataset.corporate); });
  $('#logout-menu')?.addEventListener('click', logoutUser);
  $('#developer-contact')?.addEventListener('click', openDeveloperContact);
  $('#lojasite-footer-logo')?.addEventListener('click',openLojaSitePopup);
  $('#store-description')?.addEventListener('click',()=>modal(`<img class="description-store-logo" src="${import.meta.env.BASE_URL}imagens_org/${store.id}/logo.png" alt="Logo ${escapeHtml(store.name)}"><span class="kicker">NOSSA LOJA</span><h2>${escapeHtml(store.name)}</h2><div class="description-content">${escapeHtml(info.description || store.tagline)}</div>`,'description-modal'));
  document.querySelectorAll('[data-store-section]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();document.getElementById(link.dataset.storeSection)?.scrollIntoView({behavior:'smooth',block:'start'});}));
  const sectionObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;document.querySelectorAll('.store-nav [data-store-section]').forEach(link=>link.classList.toggle('active',link.dataset.storeSection===visible.target.id));},{rootMargin:'-20% 0px -55% 0px',threshold:[0,.15,.4]});
  document.querySelectorAll('.store-page-section').forEach(section=>sectionObserver.observe(section));
  document.querySelectorAll('[data-category]').forEach(btn => btn.onclick = () => { state.category = btn.dataset.category; state.productsExpanded = false; document.querySelectorAll('[data-category]').forEach(x => x.classList.toggle('active', x===btn)); renderProducts(); $('#produtos')?.scrollIntoView({behavior:'smooth',block:'start'}); });
  document.addEventListener('click', event => { if (!event.target.closest('.header-search-wrap') && $('#search-suggestions')) $('#search-suggestions').hidden = true; }, { once: true });
  if (!state.user || staff) $('#cart')?.remove(); else if ($('#cart svg')) $('#cart svg').outerHTML = icon('cart', 22);
  loadPublicContacts();
}
function modal(content, className='') { const modalClasses=className.split(/\s+/);const centered=['manager-modal','product-modal','description-modal'].some(name=>modalClasses.includes(name))?' centered-overlay':''; $('#modal-root').innerHTML = `<div class="modal-overlay${centered}"><section class="modal ${className}" role="dialog" aria-modal="true"><button class="close" aria-label="Fechar">×</button>${content}</section></div>`; $('.close').onclick = closeModal; $('.modal-overlay').onclick = e => { if (e.target.classList.contains('modal-overlay')) closeModal(); }; }
function closeModal() { $('#modal-root').innerHTML = ''; }
function confirmProductWithoutImage(){
  return new Promise(resolve=>{
    const overlay=document.createElement('div');
    overlay.className='mini-modal-overlay';
    overlay.innerHTML='<section class="mini-modal confirm-modal" role="alertdialog" aria-modal="true"><h3>Imagem não selecionada</h3><p>Nenhuma imagem selecionada. Deseja continuar com o cadastro do produto sem imagem?</p><div class="mini-modal-actions"><button class="secondary" data-answer="no" type="button">Não</button><button class="highlight-action" data-answer="yes" type="button">Sim</button></div></section>';
    $('#modal-root').append(overlay);
    const finish=answer=>{overlay.remove();resolve(answer);};
    overlay.querySelector('[data-answer="no"]').onclick=()=>finish(false);
    overlay.querySelector('[data-answer="yes"]').onclick=()=>finish(true);
    overlay.onclick=event=>{if(event.target===overlay)finish(false);};
  });
}

async function openDeveloperContact() {
  try {
    const contact = await api('/api/public/contact');
    const email = contact.supportEmail
      ? `<a class="developer-popup-action email" href="mailto:${escapeHtml(contact.supportEmail)}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span>Falar com o suporte por e-mail</span></a>`
      : '<span class="muted">E-mail indisponível</span>';
    const whatsapp = contact.supportWhatsapp
      ? `<a class="developer-popup-action whatsapp" href="https://wa.me/${contact.supportWhatsapp}" target="_blank" rel="noopener"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.47 14.86L2 22l5.27-1.53A9.96 9.96 0 1 0 12.04 2Zm0 17.99a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.13.91.91-3.05-.2-.31a8.01 8.01 0 1 1 6.85 3.76Zm4.45-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21a7.31 7.31 0 0 1-1.35-1.68c-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.31-.75-1.8-.2-.47-.4-.41-.55-.42h-.46c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg><span>Falar com o suporte pelo WhatsApp</span></a>`
      : '<span class="muted">WhatsApp indisponível</span>';
    const overlay=document.createElement('div');
    overlay.className='mini-modal-overlay developer-popup-overlay';
    overlay.innerHTML=`<section class="mini-modal developer-popup" role="dialog" aria-modal="true" aria-labelledby="developer-popup-title"><button class="mini-modal-close close" type="button" aria-label="Fechar">×</button><div class="developer-popup-logos"><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo ${escapeHtml(systemConfig.name)}"><span></span><img src="${import.meta.env.BASE_URL}imagens_pub/logo_dev.png" alt="Logo EVOTECHUB"></div><span class="kicker">SUPORTE DAS LOJAS</span><h3 id="developer-popup-title">Fale com a EVOTECHUB</h3><div class="developer-popup-actions">${email}${whatsapp}</div></section>`;
    $('#modal-root').append(overlay);
    const closePopup=()=>overlay.remove();
    overlay.querySelector('.mini-modal-close').onclick=closePopup;
    overlay.onclick=event=>{if(event.target===overlay)closePopup();};
  } catch { toast('Os contatos de suporte estarão disponíveis no ambiente publicado.', 'error'); }
}

function openLojaSitePopup(){
  const overlay=document.createElement('div');
  overlay.className='mini-modal-overlay lojasite-popup-overlay';
  overlay.innerHTML=`<section class="mini-modal lojasite-popup" role="dialog" aria-modal="true" aria-labelledby="lojasite-popup-title"><button class="mini-modal-close close" type="button" aria-label="Fechar">×</button><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo ${escapeHtml(systemConfig.name)}"><h3 id="lojasite-popup-title">${escapeHtml(systemConfig.name.toLocaleUpperCase('pt-BR'))}</h3><p>${escapeHtml(systemConfig.slogan)}</p><button class="lojasite-portal-button" type="button">Portal ${escapeHtml(systemConfig.name)}</button></section>`;
  $('#modal-root').append(overlay);
  const closePopup=()=>overlay.remove();
  overlay.querySelector('.mini-modal-close').onclick=closePopup;
  overlay.onclick=event=>{if(event.target===overlay)closePopup();};
  overlay.querySelector('.lojasite-portal-button').onclick=()=>{
    overlay.innerHTML=`<section class="mini-modal portal-confirm-popup" role="alertdialog" aria-modal="true" aria-labelledby="portal-confirm-title"><h3 id="portal-confirm-title">Deseja ser direcionado para o portal ${escapeHtml(systemConfig.name.toLocaleUpperCase('pt-BR'))}?</h3><div class="mini-modal-actions"><button class="secondary" data-portal-answer="no" type="button">Não</button><button class="lojasite-portal-button" data-portal-answer="yes" type="button">Sim</button></div></section>`;
    overlay.querySelector('[data-portal-answer="no"]').onclick=closePopup;
    overlay.querySelector('[data-portal-answer="yes"]').onclick=()=>{location.href='https://lojasite.com.br/';};
  };
}

async function loadPublicContacts() {
  try {
    const contact = await api('/api/public/contact');
    document.querySelectorAll('[data-support-email]').forEach(element => { if (!contact.supportEmail) return; element.textContent = contact.supportEmail; element.href = `mailto:${contact.supportEmail}`; element.hidden = false; });
    document.querySelectorAll('[data-whatsapp]').forEach(element => { if (!contact.newStoreWhatsapp) return; element.href = `https://wa.me/${contact.newStoreWhatsapp}?text=${encodeURIComponent('Olá! Quero adquirir minha LojaSite.')}`; element.hidden = false; });
    document.querySelectorAll('[data-new-store-email]').forEach(element => { if (!contact.newStoreEmail) return; element.href = `mailto:${contact.newStoreEmail}?subject=${encodeURIComponent('Quero adquirir minha LojaSite')}`; element.hidden = false; });
    document.querySelectorAll('[data-new-store-whatsapp-label]').forEach(element => { element.textContent = contact.newStoreWhatsapp || ''; });
    document.querySelectorAll('[data-new-store-email-label]').forEach(element => { element.textContent = contact.newStoreEmail || ''; });
  } catch { /* Os contatos não impedem o uso da loja. */ }
}

async function openPlanContact(planName) {
  try {
    const contact = await api('/api/public/contact');
    const subject = `Tenho interesse no plano ${planName}`;
    const email = contact.newStoreEmail
      ? `<a class="developer-popup-action email" href="mailto:${escapeHtml(contact.newStoreEmail)}?subject=${encodeURIComponent(subject)}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span>Falar por e-mail</span></a>`
      : '<span class="muted">E-mail comercial indisponível</span>';
    const whatsapp = contact.newStoreWhatsapp
      ? `<a class="developer-popup-action whatsapp" href="https://wa.me/${contact.newStoreWhatsapp}?text=${encodeURIComponent(`Olá! Tenho interesse no plano ${planName} da LojaSite.`)}" target="_blank" rel="noopener"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.47 14.86L2 22l5.27-1.53A9.96 9.96 0 1 0 12.04 2Zm0 17.99a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.13.91.91-3.05-.2-.31a8.01 8.01 0 1 1 6.85 3.76Zm4.45-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21a7.31 7.31 0 0 1-1.35-1.68c-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.31-.75-1.8-.2-.47-.4-.41-.55-.42h-.46c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg><span>Falar pelo WhatsApp</span></a>`
      : '<span class="muted">WhatsApp comercial indisponível</span>';
    const overlay = document.createElement('div');
    overlay.className = 'mini-modal-overlay developer-popup-overlay';
    overlay.innerHTML = `<section class="mini-modal developer-popup plan-contact-popup" role="dialog" aria-modal="true" aria-labelledby="plan-contact-title"><button class="mini-modal-close close" type="button" aria-label="Fechar">×</button><img class="plan-contact-logo" src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo ${escapeHtml(systemConfig.name)}"><span class="kicker">PLANO ${escapeHtml(planName.toLocaleUpperCase('pt-BR'))}</span><h3 id="plan-contact-title">Como prefere falar conosco?</h3><div class="developer-popup-actions">${email}${whatsapp}</div></section>`;
    $('#modal-root').append(overlay);
    const closePopup = () => overlay.remove();
    overlay.querySelector('.mini-modal-close').onclick = closePopup;
    overlay.onclick = event => { if (event.target === overlay) closePopup(); };
  } catch { toast('Os contatos comerciais estarão disponíveis no ambiente publicado.', 'error'); }
}

function renderPortal() {
  document.title = `${systemConfig.name} · Lojas online para organizações`;
  document.documentElement.style.setProperty('--primary', '#176bff');
  document.documentElement.style.setProperty('--accent', '#70e1c0');
  const showcaseProducts=[
    {group:1,name:'Café 500g',category:'ALIMENTOS',price:14.8,image:'1.1_cafe-500g-rs1480.png'},
    {group:1,name:'Fone Bluetooth',category:'ELETRÔNICOS',price:35,image:'1.2_fonebluetooth-1und-rs3500.png'},
    {group:1,name:'Medicamento 500mg',category:'FARMÁCIA',price:37.5,image:'1.3_remedio-500mg-rs3750.png'},
    {group:1,name:'TV 50 polegadas',category:'ELETRÔNICOS',price:2899,image:'1.4_tv-50pol-rs289900.png'},
    {group:2,name:'Serviço de Barba',category:'BARBEARIA',price:35,image:'2.1_servicobarba--rs3500.png',service:true},
    {group:2,name:'Serviço de Manicure',category:'BELEZA',price:29.9,image:'2.2_servicomanicure--rs2990.png',service:true},
    {group:2,name:'Alinhamento Automotivo',category:'SERVIÇO AUTOMOTIVO',price:60,image:'2.3_servicomecanicaalinhamento--rs6000.png',service:true},
    {group:2,name:'Troca de Tela de Celular',category:'ASSISTÊNCIA TÉCNICA',price:85,image:'2.4_servicocelulartrocadetela--rs8500.png',service:true},
    {group:3,name:'Ração 10kg',category:'PET SHOP',price:45.76,image:'3.1_racao-10kg-rs4576.png'},
    {group:3,name:'Creme de Cabelo 1kg',category:'COSMÉTICOS',price:28.2,image:'3.2_cremedecabelo-1kg-rs2820.png'},
    {group:3,name:'Kit de Maquiagem 7 peças',category:'BELEZA',price:32.99,image:'3.3_maquiagem-7pecas-rs3299.png'},
    {group:3,name:'Cimento 50kg',category:'CONSTRUÇÃO',price:45.8,image:'3.4_cimento-50kg-rs4580.png'}
  ];
  const showcaseCards=[1,2,3].map(group=>`<div class="portal-showcase-group" aria-label="Grupo ${group} de 3">${showcaseProducts.filter(product=>product.group===group).map(product=>`<article class="portal-product-card"><div class="portal-product-art"><span>${escapeHtml(product.category)}</span><img src="${BASE_URL}imagens_pub/vitrine/${encodeURIComponent(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"></div><div><h3>${escapeHtml(product.name)}</h3><strong>${money(product.price)}</strong><button type="button">Ver ${product.service?'serviço':'produto'}</button></div></article>`).join('')}</div>`).join('');
  const plans=systemConfig.plans.map(plan=>`<article class="portal-plan${plan.recommended?' featured':''}"><h3>${escapeHtml(plan.name)}</h3><div class="plan-stars" aria-label="${plan.stars} de 5 estrelas">${'★'.repeat(plan.stars)}<i>${'★'.repeat(5-plan.stars)}</i></div><div class="plan-price">${plan.startingAt?'<small>A partir de</small>':''}<small>R$</small><strong>${plan.monthlyPrice.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>/mês</small></div><ul>${plan.benefits.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul><a href="#planos-contato" data-plan-contact="${escapeHtml(plan.name)}">Quero esse plano</a></article>`).join('');
  $('#app').innerHTML = `<div class="portal"><header class="header portal-header"><a class="logo portal-logo portal-logo-only" href="#sua-loja" aria-label="Voltar ao início"><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo ${escapeHtml(systemConfig.name)}"></a><nav><a href="#sua-loja">SUA LOJA</a><a href="#vitrine">VITRINE</a><a href="#tipos-venda">TIPOS DE VENDA</a><a href="#seguranca-lgpd">SEGURANÇA E LGPD</a><a href="#planos-contato">PLANOS</a></nav><a class="portal-access" href="#planos-contato">Acessar uma loja</a></header>
  <main>
  <section class="portal-hero portal-page-section" id="sua-loja"><div><span class="kicker">SUA LOJA, SEU ENDEREÇO, SUAS VENDAS</span><h1>Transforme seu estoque em uma loja online.</h1><p>Tenha um mostruário profissional, organize produtos e venda pelo próprio site — com uma experiência segura, prática e feita para o seu negócio.</p><a class="portal-primary" href="#vitrine">Conhecer a ${escapeHtml(systemConfig.name)} <span>↓</span></a></div><div class="portal-window"><div class="window-bar"><i></i><i></i><i></i><small>lojasite.com.br/sua-loja</small></div><div class="window-content"><span class="your-logo-placeholder">Sua Logo</span><div><small>SEU NEGÓCIO ONLINE</small><strong>Estoque, vitrine e vendas em <b>um só lugar</b></strong></div></div></div><div class="hero-store-access-block"><div class="store-access-guidance"><span>Digite o complemento do link da loja informado pelo desenvolvedor.</span><button id="access-link-help" type="button">OBS!</button></div><form class="hero-store-access" id="portal-access-form"><span>lojasite.com.br/</span><input name="suffix" placeholder="sua_organizacao" pattern="[a-zA-Z0-9_-]+" required><button type="submit">Acessar minha loja</button></form></div></section>
  <section class="portal-section portal-page-section showcase-section" id="vitrine"><div class="portal-title"><span class="kicker">VITRINE</span><h2>Atendemos ao seu ramo de atividade. Seus produtos e categorias, tudo personalizado por você.</h2><p>Sua loja online com a sua cara. Experimente!</p></div><div class="showcase-commerce-badge">Forneça Produtos ou Serviços Online!</div><div class="portal-showcase-wrap"><button id="showcase-previous" type="button" aria-label="Grupo anterior">←</button><div class="portal-showcase" id="portal-showcase">${showcaseCards}</div><button id="showcase-next" type="button" aria-label="Próximo grupo">→</button></div></section>
  <section class="portal-section portal-page-section sales-section" id="tipos-venda"><div class="portal-title"><span class="kicker">TIPOS DE VENDA</span><h2>Venda do jeito que combina com sua operação.</h2><p>Do atendimento pessoal à compra totalmente online, sem obrigar o lojista a escolher apenas um caminho.</p></div><div class="sales-models"><article><div class="sales-symbol whatsapp-sale-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.47 14.86L2 22l5.27-1.53A9.96 9.96 0 1 0 12.04 2Zm0 17.99a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.13.91.91-3.05-.2-.31a8.01 8.01 0 1 1 6.85 3.76Zm4.45-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21a7.31 7.31 0 0 1-1.35-1.68c-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.31-.75-1.8-.2-.47-.4-.41-.55-.42h-.46c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg><i>$</i></div><b>01</b><span>SEM LOGIN</span><h3>Ordem de serviço pelo WhatsApp</h3><p>O visitante escolhe um produto, confirma a solicitação e é encaminhado diretamente ao WhatsApp operacional da loja. Simples, rápido e ideal para vendas consultivas.</p></article><article><div class="sales-symbol cart-sale-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H7"/><circle cx="10" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg></div><b>02</b><span>COMPRA ONLINE</span><h3>Carrinho e pagamento no site</h3><p>O próprio cliente cria seu acesso, adiciona produtos ao carrinho e finaliza a compra com sua conta protegida, usando PIX ou cartão conforme a configuração da loja.</p></article></div></section>
  <section class="portal-section portal-page-section security-section" id="seguranca-lgpd"><div class="portal-title"><span class="kicker">SEGURANÇA E LGPD</span><h2>Proteção técnica com transparência, sem promessas ou selos inventados.</h2><p>A plataforma aplica controles concretos alinhados aos princípios de segurança, prevenção e necessidade da LGPD. Conformidade jurídica completa também depende das práticas de cada organização controladora.</p></div><div class="security-emblems"><div class="security-emblem-item lgpd-emblem" aria-label="LGPD"><div class="lgpd-feature-badge"><svg viewBox="0 0 160 174" aria-hidden="true"><defs><linearGradient id="lgpd-shield-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d7cff"/><stop offset=".55" stop-color="#164bb6"/><stop offset="1" stop-color="#09276c"/></linearGradient></defs><path class="shield-body" d="M80 8 133 27v47c0 43-22 73-53 91-31-18-53-48-53-91V27L80 8Z"/><path class="shield-line" d="M80 20 122 35v39c0 35-16 59-42 76-26-17-42-41-42-76V35L80 20Z"/><g class="chain-lock"><rect x="58" y="50" width="44" height="38" rx="8"/><path d="M68 50V39c0-16 24-16 24 0v11"/><circle cx="80" cy="68" r="4"/><path d="M80 72v8"/></g><rect class="seal-text-background" x="37" y="98" width="86" height="34" rx="9"/><text class="lgpd-seal-text" x="80" y="123" text-anchor="middle">LGPD</text></svg></div></div><div class="security-emblem-item owasp-emblem" aria-label="OWASP - CSP"><div class="owasp-feature-badge"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="medal-ring" cx="50" cy="50" r="43"/><circle class="medal-inner" cx="50" cy="50" r="34"/><path class="medal-laurel" d="M31 74c-13-11-15-27-8-41M69 74c13-11 15-27 8-41M25 39l-9-4m10 16-10 1m15 12-8 7m52-32 9-4M74 51l10 1M69 64l8 7"/><rect class="seal-text-background" x="16" y="27" width="68" height="47" rx="9"/><text class="owasp-seal-title" x="50" y="48" text-anchor="middle">OWASP</text><text class="owasp-seal-subtitle" x="50" y="68" text-anchor="middle">CSP</text></svg></div></div></div><div class="security-badges" aria-label="Controles de segurança implementados">${['ISOLAMENTO','ACESSO MÍNIMO','TOKENS PROTEGIDOS','RATE LIMIT'].map(label=>`<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6c0 5.2-3.4 9.3-8 11-4.6-1.7-8-5.8-8-11V5l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><b>${label}</b></span>`).join('')}</div><div class="security-grid"><article><strong>Isolamento por organização</strong><p>Sessões validam a organização e clientes não podem consultar cadastros de outros clientes.</p></article><article><strong>Acesso mínimo necessário</strong><p>Funções corporativas são autorizadas por perfil e rotas sensíveis exigem autenticação.</p></article><article><strong>Proteções de aplicação</strong><p>Tokens internos criptografados, limites contra abuso, CSP, headers defensivos e validação de entradas.</p></article><article><strong>Privacidade por finalidade</strong><p>Dados públicos são separados de configurações privadas e credenciais permanecem somente no backend.</p></article></div><div class="security-references"><span>Referências oficiais:</span><a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm" target="_blank" rel="noopener">LGPD — Lei 13.709/2018</a><a href="https://www.gov.br/saude/pt-br/acesso-a-informacao/lgpd/principios/principios/" target="_blank" rel="noopener">Princípios da LGPD</a><a href="https://owasp.org/www-community/controls/Content_Security_Policy" target="_blank" rel="noopener">OWASP — CSP</a></div></section>
  <section class="portal-section portal-page-section plans-section" id="planos-contato"><div class="portal-title"><span class="kicker">PLANOS</span><h2>Comece a partir de R$ 49,90 por mês.</h2><p>Escolha uma estrutura compatível com o momento da sua loja.</p></div><div class="portal-plans">${plans}</div><footer class="portal-simple-footer"><button class="footer-developer" id="portal-developer-footer" type="button" aria-label="Abrir contatos da EVOTECHUB"><img src="${import.meta.env.BASE_URL}imagens_pub/logo_dev.png" alt="Logo EVOTECHUB"><span>© EVOTECHUB 2026 - Todos os direitos reservados.</span></button></footer></section>
  </main></div>`;
  $('#portal-access-form').onsubmit = event => { event.preventDefault(); const suffix = new FormData(event.currentTarget).get('suffix').trim().toLowerCase(); location.href = `${import.meta.env.BASE_URL}${encodeURIComponent(suffix)}`; };
  $('#access-link-help').onclick = () => {
    const overlay = document.createElement('div');
    overlay.className = 'mini-modal-overlay access-link-help-overlay';
    overlay.innerHTML = `<section class="mini-modal access-link-help-popup" role="dialog" aria-modal="true" aria-labelledby="access-link-help-title"><button class="mini-modal-close close" type="button" aria-label="Fechar">×</button><span class="access-help-badge">OBS!</span><h3 id="access-link-help-title">Complemento do link da loja</h3><p>Caso não se recorde o complemento do link, contate o suporte clicando no ícone do desenvolvedor localizado no rodapé do site. Mas, caso a loja ainda não tenha sido cadastrada, entre em contato conosco selecionando um plano na seção de PLANOS.</p></section>`;
    $('#modal-root').append(overlay);
    const closePopup = () => overlay.remove();
    overlay.querySelector('.mini-modal-close').onclick = closePopup;
    overlay.onclick = event => { if (event.target === overlay) closePopup(); };
  };
  $('#portal-developer-footer').onclick = openDeveloperContact;
  const goToPortalSection = (sectionId, focusSelector) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (focusSelector) setTimeout(() => document.querySelector(focusSelector)?.focus({ preventScroll: true }), 650);
  };
  $('.portal-access').onclick = event => {
    event.preventDefault();
    const overlay = document.createElement('div');
    overlay.className = 'mini-modal-overlay portal-access-choice-overlay';
    overlay.innerHTML = `<section class="mini-modal portal-access-choice" role="dialog" aria-modal="true" aria-labelledby="portal-access-choice-title"><button class="mini-modal-close close" type="button" aria-label="Fechar">×</button><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo ${escapeHtml(systemConfig.name)}"><span class="kicker">COMO PODEMOS AJUDAR?</span><h3 id="portal-access-choice-title">Deseja criar ou acessar uma loja?</h3><div class="portal-access-choice-actions"><button type="button" data-access-existing>Acessar Loja Existente</button><button type="button" data-access-create>Criar uma Loja</button></div></section>`;
    $('#modal-root').append(overlay);
    const closePopup = () => overlay.remove();
    overlay.querySelector('.mini-modal-close').onclick = closePopup;
    overlay.onclick = clickEvent => { if (clickEvent.target === overlay) closePopup(); };
    overlay.querySelector('[data-access-existing]').onclick = () => { closePopup(); goToPortalSection('sua-loja', '#portal-access-form input[name="suffix"]'); };
    overlay.querySelector('[data-access-create]').onclick = () => { closePopup(); goToPortalSection('planos-contato'); };
  };
  document.querySelectorAll('[data-plan-contact]').forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      openPlanContact(button.dataset.planContact);
    };
  });
  const portalLinks=document.querySelectorAll('.portal-header nav a[href^="#"]');
  const portalObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;portalLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${visible.target.id}`));},{rootMargin:'-25% 0px -55% 0px',threshold:[0,.15,.4]});
  portalLinks.forEach(link=>{const section=document.querySelector(link.getAttribute('href'));if(section){portalObserver.observe(section);link.onclick=event=>{event.preventDefault();goToPortalSection(section.id);};}});
  document.querySelector('.portal-logo[href^="#"]')?.addEventListener('click',event=>{event.preventDefault();goToPortalSection('sua-loja');});
  document.querySelector('.portal-primary[href^="#"]')?.addEventListener('click',event=>{event.preventDefault();goToPortalSection('vitrine');});
  const showcase=$('#portal-showcase');
  const moveShowcase=direction=>{const group=showcase?.querySelector('.portal-showcase-group');if(!showcase||!group)return;const step=group.offsetWidth+18;const atEnd=showcase.scrollLeft+showcase.clientWidth>=showcase.scrollWidth-8;const atStart=showcase.scrollLeft<=8;showcase.scrollTo({left:direction>0?(atEnd?0:showcase.scrollLeft+step):(atStart?showcase.scrollWidth:showcase.scrollLeft-step),behavior:'smooth'});};
  let showcaseTimer=setInterval(()=>moveShowcase(1),3200);
  const restartShowcase=()=>{clearInterval(showcaseTimer);showcaseTimer=setInterval(()=>moveShowcase(1),3200);};
  $('#showcase-previous').onclick=()=>{moveShowcase(-1);restartShowcase();};
  $('#showcase-next').onclick=()=>{moveShowcase(1);restartShowcase();};
  showcase.addEventListener('mouseenter',()=>clearInterval(showcaseTimer));
  showcase.addEventListener('mouseleave',restartShowcase);
  loadPublicContacts();
}
function openLogin(next) {
  modal(`<div class="login-system-logo"><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo LojaSite"></div><span class="kicker">ÁREA DE ACESSO</span><h2>Bom ter você aqui</h2><p class="muted">Entre com seu login e senha para acessar sua conta.</p><form id="login-form"><div class="login-process"><label>Login<input name="login" autocomplete="username" placeholder="Seu login" required></label><label>Senha<input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" minlength="6" required></label><label class="show-password"><input id="show-password" type="checkbox"> <span>Exibir senha</span></label><button class="primary full login-submit" type="submit">Entrar</button></div><p class="form-error" aria-live="polite"></p></form><div class="signup-process"><span>Ainda não possui uma conta?</span><button class="signup-modal-button full" id="signup-modal" type="button">Cadastre-se</button></div>`, 'login-modal');
  $('#show-password').onchange = event => { $('#login-password').type = event.currentTarget.checked ? 'text' : 'password'; };
  $('#signup-modal').onclick = openRegistration;
  $('#login-form').onsubmit = async e => { e.preventDefault(); const btn=e.target.querySelector('button'); btn.disabled=true; btn.textContent='Entrando...'; try { const body=Object.fromEntries(new FormData(e.target)); const data=await api(`/api/stores/${slug}/auth/login`,{method:'POST',body:JSON.stringify(body)}); state.token=data.token; state.user=data.user; sessionStorage.setItem(`token:${slug}`,data.token); sessionStorage.setItem(`user:${slug}`,JSON.stringify(data.user)); closeModal(); renderApp(); toast('Login realizado com sucesso.'); if(typeof next === 'function') next(); } catch(error){ const errorElement=$('.form-error'); if(errorElement){errorElement.textContent=error.message;btn.disabled=false;btn.textContent='Entrar';}else{toast(error.message,'error');} } };
}
function openRegistration() {
  modal(`<div class="login-system-logo"><img src="${import.meta.env.BASE_URL}imagens_pub/logo.png" alt="Logo LojaSite"></div><span class="kicker">CADASTRO DE CLIENTE</span><h2>Crie sua conta</h2><p class="muted">Seu login será gerado automaticamente a partir do seu nome.</p><form id="registration-form"><label>Nome completo<input name="name" autocomplete="name" required minlength="5"></label><label>CPF ou CNPJ<input name="cpfCnpj" inputmode="numeric" required></label><label>Telefone / WhatsApp<input name="phone" type="tel" autocomplete="tel" required></label><label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirme a senha<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="8" required></label><button class="primary full" type="submit">Cadastrar</button><p class="form-error" aria-live="polite"></p></form>`, 'login-modal registration-modal');
  $('#registration-form').onsubmit=async event=>{
    event.preventDefault();
    const button=event.currentTarget.querySelector('[type=submit]');
    const errorElement=event.currentTarget.querySelector('.form-error');
    button.disabled=true;button.textContent='Cadastrando...';errorElement.textContent='';
    try {
      const data=await api(`/api/stores/${slug}/auth/register`,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});
      modal(`<div class="success-icon">✓</div><span class="kicker">CADASTRO CONCLUÍDO</span><h2>Seu login é</h2><div class="generated-login">${escapeHtml(data.login)}</div><p class="muted">Guarde este login. Ele será usado com a senha que você criou.</p><button class="primary full" id="registration-login" type="button">Fazer login</button>`,'result-modal');
      $('#registration-login').onclick=()=>openLogin();
    } catch(error) { errorElement.textContent=error.message;button.disabled=false;button.textContent='Cadastrar'; }
  };
}
function openAccount() { const initial=escapeHtml(state.user.name?.trim()?.[0]?.toUpperCase()||'U'); const hasPhoto=Boolean(state.user.photoUrl); const customer=state.user.role==='cliente'; const avatar=hasPhoto?`<img src="${escapeHtml(state.user.photoUrl)}" alt="Foto atual">`:`<span>${initial}</span>`; const photoAction=hasPhoto?`<button class="photo-remove" id="remove-profile-photo" type="button">Remover ou alterar foto</button><small>Para adicionar outra imagem, remova primeiro a foto atual.</small>`:`<div class="photo-actions"><label class="photo-picker" data-label="Escolher foto">Escolher foto<input class="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="photo-picker" data-label="Tirar foto">Tirar foto<input class="profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" capture="user"></label></div><small>JPG, PNG ou WEBP de até 4 MB.</small>`; modal(`<span class="kicker">MINHA CONTA</span><h2>Dados Cadastrais</h2><div class="profile-photo-editor"><div class="profile-photo-preview" id="profile-photo-preview">${avatar}</div><div><strong>${escapeHtml(state.user.name)}</strong><small>${escapeHtml(state.user.cargo || '')}</small>${photoAction}</div></div>${customer?'<button class="secondary full" id="orders">Ver minhas compras</button>':''}<button class="text-button full" id="logout">Sair da conta</button>`); document.querySelectorAll('.profile-photo-input').forEach(input=>input.addEventListener('change',uploadProfilePhoto)); $('#remove-profile-photo')?.addEventListener('click',removeProfilePhoto); $('#orders')?.addEventListener('click',showOrders); $('#logout').onclick=()=>{ sessionStorage.removeItem(`token:${slug}`);sessionStorage.removeItem(`user:${slug}`);state.token='';state.user=null;closeModal();renderApp();toast('Você saiu da conta.');}; }
async function removeProfilePhoto() { if(!confirm('A imagem anterior será removida. Deseja continuar?'))return;const button=$('#remove-profile-photo');button.disabled=true;button.textContent='Removendo...';try{await api(`/api/stores/${slug}/profile/photo`,{method:'DELETE'});state.user.photoUrl='';sessionStorage.setItem(`user:${slug}`,JSON.stringify(state.user));openAccount();toast('Foto removida. Agora você pode escolher uma nova imagem.');}catch(error){button.disabled=false;button.textContent='Remover ou alterar foto';toast(error.message,'error');} }
async function uploadProfilePhoto(event) { const file=event.currentTarget.files?.[0]; if(!file)return;if(file.size>4*1024*1024)return toast('A imagem deve ter no máximo 4 MB.','error');const picker=event.currentTarget.closest('.photo-picker');picker.classList.add('loading');picker.childNodes[0].textContent='Enviando...';try{const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const data=await api(`/api/stores/${slug}/profile/photo`,{method:'POST',body:JSON.stringify({image})});state.user.photoUrl=data.photoUrl;sessionStorage.setItem(`user:${slug}`,JSON.stringify(state.user));closeModal();renderApp();toast('Foto atualizada com sucesso.');}catch(error){picker.classList.remove('loading');picker.childNodes[0].textContent=picker.dataset.label;toast(error.message,'error');} }
function openPaymentData() { modal(`<span class="kicker">MINHA CONTA</span><h2>Dados de Pagamento</h2><div class="notice-panel"><h3>Formas de pagamento</h3><p>Seus dados de pagamento serão apresentados e administrados com segurança nesta área.</p></div>`); }
function logoutUser(){sessionStorage.removeItem(`token:${slug}`);sessionStorage.removeItem(`user:${slug}`);state.token='';state.user=null;renderApp();toast('Você saiu da conta.');}

async function corporateProducts() { const data = await api(`/api/stores/${slug}/corporate/products`); return data.products; }
function parseBrazilianPrice(value) { const normalized=String(value||'').trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.'); return Number(normalized); }
function formatBrazilianPriceInput(input) {
  const digits=input.value.replace(/\D/g,'');
  if(!digits){input.value='';return;}
  const padded=digits.padStart(3,'0');
  const integer=padded.slice(0,-2).replace(/^0+(?=\d)/,'')||'0';
  input.value=`${integer},${padded.slice(-2)}`;
  input.setSelectionRange(input.value.length,input.value.length);
}
function renderCorporateWorkspace(page, title, content) {
  renderApp();
  const main=$('#app > main');
  main.className='corporate-workspace';
  main.innerHTML=`<section class="workspace-title"><div><span class="kicker">ÁREA CORPORATIVA</span><h1>${escapeHtml(title)}</h1></div></section><div class="workspace-content">${content}</div>`;
  const homeButton=$(`[data-corporate="${page}"]`);
  if(homeButton){homeButton.textContent='Home';homeButton.onclick=renderApp;$('.user-menu-header')?.after(homeButton);}
  $('#header-search').oninput=event=>{state.query=event.target.value;renderApp();};
  scrollTo({top:0,behavior:'smooth'});
}
async function openCorporate(page) {
  const titles = { products: 'Cadastrar Produto', stock: 'Estoque', payments: 'Sistema de Pagamento', access: 'Gestão de Logins' };
  const staffPages = ['products', 'stock'];
  const managementPages = ['payments', 'access'];
  if (staffPages.includes(page) && !['admin', 'gerente', 'supervisor', 'operador'].includes(state.user?.role)) return toast('Acesso negado.', 'error');
  if (managementPages.includes(page) && !['admin', 'gerente'].includes(state.user?.role)) return toast('Acesso exclusivo para admin e gerente.', 'error');
  if (page === 'products') {
    const [categoriesResult,unitsResult]=await Promise.allSettled([api(`/api/stores/${slug}/corporate/categories`).then(data=>data.categories),api(`/api/stores/${slug}/corporate/measurement-units`).then(data=>data.units)]);
    if(categoriesResult.status==='rejected')return toast(categoriesResult.reason.message,'error');
    const categoryItems=categoriesResult.value,unitItems=unitsResult.status==='fulfilled'?unitsResult.value:[],manualMeasurementUnit=unitsResult.status==='rejected';
    if(manualMeasurementUnit)toast('As unidades cadastradas não puderam ser consultadas. Informe a unidade manualmente.','error');
    modal(`<span class="kicker">ÁREA CORPORATIVA</span><h2>${titles[page]}</h2><p class="muted">Cadastre um produto real no catálogo da organização.</p><form id="product-form"><div class="checkout-grid"><label>Nome *<input name="name" required></label><label>Categoria *<select name="category" required><option value="">Selecione</option>${categoryItems.map(item=>`<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Preço original (R$) *<input name="price" id="product-price" type="text" inputmode="numeric" placeholder="0,00" required></label><label class="discount-field">Desconto (%)<input name="discountPercentage" id="product-discount-percentage" type="number" inputmode="decimal" min="0" max="99.99" step="0.01" placeholder="Ex.: 10"></label><label class="discount-field">Valor com desconto (R$)<input name="discountPrice" id="product-discount-price" type="text" inputmode="numeric" placeholder="0,00"></label><label>Quantidade *<input name="stock" type="text" inputmode="numeric" pattern="[0-9]+" placeholder="Ex.: 10" required></label><label>Medida por unidade *<input name="measurementQuantity" type="number" min="0.001" step="0.001" placeholder="Ex.: 750" required></label>${manualMeasurementUnit?'<label>Unidade de medida *<input name="measurementUnit" maxlength="30" placeholder="Ex.: gramas, g, unidade ou und" required></label>':`<label>Unidade de medida *<select name="measurementUnitId" required><option value="">Selecione</option>${unitItems.map(item=>`<option value="${escapeHtml(item.id)}" data-unit="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}</select></label>`}<label class="barcode-field">Código de Barras *<input name="barcode" type="text" inputmode="numeric" pattern="[0-9]{4,32}" minlength="4" maxlength="32" placeholder="Leia ou digite o código" required></label><label class="wide product-description-field">Descrição<textarea name="description" placeholder="Descreva o produto"></textarea></label><div class="wide product-photo-field"><strong>Imagem do produto</strong><div id="product-photo-preview">Nenhuma imagem selecionada</div><div class="photo-actions"><label class="photo-picker">Escolher foto<input class="product-photo-input" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="photo-picker">Tirar foto<input class="product-photo-input" type="file" accept="image/png,image/jpeg,image/webp" capture="environment"></label></div><small>JPG, PNG ou WEBP de até 4 MB.</small></div></div><button class="primary full product-submit" type="submit" disabled>Cadastrar Produto</button><p class="form-error"></p></form>`, 'corporate-modal product-modal');
    const productForm=$('#product-form'),productSubmit=productForm.querySelector('[type=submit]'),stockInput=productForm.elements.stock,barcodeInput=productForm.elements.barcode;
    const updateProductSubmit=()=>{const price=parseBrazilianPrice(productForm.elements.price.value),discountPrice=parseBrazilianPrice(productForm.elements.discountPrice.value),percentage=Number(productForm.elements.discountPercentage.value||0);const validPrice=price>0;const validDiscount=(!discountPrice&&!percentage)||(discountPrice>0&&discountPrice<price&&percentage>0&&percentage<100);productSubmit.disabled=!(productForm.checkValidity()&&validPrice&&validDiscount);};
    stockInput.addEventListener('input',()=>{stockInput.value=stockInput.value.replace(/\D/g,'');updateProductSubmit();});
    barcodeInput.addEventListener('input',()=>{barcodeInput.value=barcodeInput.value.replace(/\D/g,'');updateProductSubmit();});
    productForm.addEventListener('input',updateProductSubmit);productForm.addEventListener('change',updateProductSubmit);
    const priceInput=$('#product-price'),discountPercentageInput=$('#product-discount-percentage'),discountPriceInput=$('#product-discount-price');
    const updateDiscountFromPercentage=()=>{const price=parseBrazilianPrice(priceInput.value),percentage=Number(discountPercentageInput.value);discountPriceInput.value=price>0&&percentage>0&&percentage<100?(price*(1-percentage/100)).toFixed(2).replace('.',','):'';updateProductSubmit();};
    const updateDiscountFromPrice=()=>{formatBrazilianPriceInput(discountPriceInput);const price=parseBrazilianPrice(priceInput.value),discountPrice=parseBrazilianPrice(discountPriceInput.value);discountPercentageInput.value=price>0&&discountPrice>0&&discountPrice<price?String(Number(((1-discountPrice/price)*100).toFixed(2))):'';updateProductSubmit();};
    priceInput.oninput=event=>{formatBrazilianPriceInput(event.currentTarget);if(discountPercentageInput.value)updateDiscountFromPercentage();else updateProductSubmit();};
    discountPercentageInput.oninput=updateDiscountFromPercentage;
    discountPriceInput.oninput=updateDiscountFromPrice;
    let productImageData=''; document.querySelectorAll('.product-photo-input').forEach(input=>input.onchange=async event=>{const file=event.currentTarget.files?.[0];if(!file)return;if(file.size>4*1024*1024){event.currentTarget.value='';return toast('A imagem deve ter no máximo 4 MB.','error');}productImageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});$('#product-photo-preview').innerHTML=`<img src="${productImageData}" alt="Pré-visualização do produto">`;});
    productForm.onsubmit = async event => { event.preventDefault(); if(!productForm.checkValidity())return productForm.reportValidity();if(!productImageData&&!await confirmProductWithoutImage())return; productSubmit.disabled=true; try { const body=Object.fromEntries(new FormData(event.currentTarget)); if(!manualMeasurementUnit){const selected=event.currentTarget.elements.measurementUnitId.selectedOptions[0];body.measurementUnit=selected.dataset.unit;delete body.measurementUnitId;}body.imageData=productImageData;body.price=parseBrazilianPrice(body.price);body.discountPrice=body.discountPrice?parseBrazilianPrice(body.discountPrice):0;body.discountPercentage=body.discountPercentage?Number(body.discountPercentage):0;body.stock=Number(body.stock);body.measurementQuantity=Number(body.measurementQuantity);await api(`/api/stores/${slug}/corporate/products`,{method:'POST',body:JSON.stringify(body)});const refreshed=await api(`/api/stores/${slug}`);state.store=refreshed.store;closeModal();renderApp();toast('Produto cadastrado com sucesso.'); } catch(error){$('.form-error').textContent=error.message;updateProductSubmit();} };
    return;
  }
  if (page === 'stock') {
    try { const items=await corporateProducts(); const canManageParameters=['admin','gerente','supervisor'].includes(state.user.role); renderCorporateWorkspace(page,titles[page],`<section class="workspace-panel"><div class="stock-heading"><div><h2>Todos os produtos cadastrados</h2><p class="muted">${items.length} ${items.length===1?'produto cadastrado':'produtos cadastrados'} nesta organização.</p></div><div class="stock-actions">${canManageParameters?'<button id="stock-units" type="button">Gerenciar Unidade de Medidas</button><button id="stock-categories" type="button">Gerenciar Categorias</button>':''}<button id="new-product" type="button">Novo Produto</button></div></div><div class="stock-list">${items.map(item=>`<article><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.id)} · ${escapeHtml(item.category)}${item.measurementQuantity&&item.measurementUnitPlural?` · ${item.measurementQuantity} ${escapeHtml(item.measurementUnitPlural)}/UNIDADE`:''}</small></div><label>Quantidade<input type="number" min="0" step="1" value="${item.stock}" data-stock="${item.id}"></label><button data-save-stock="${item.id}">Salvar</button></article>`).join('')||'<p class="muted">Nenhum produto cadastrado.</p>'}</div></section>`); $('#new-product').onclick=()=>openCorporate('products'); $('#stock-categories')?.addEventListener('click',openCategoryManager); $('#stock-units')?.addEventListener('click',openMeasurementUnitManager); document.querySelectorAll('[data-save-stock]').forEach(button=>button.onclick=async()=>{const input=document.querySelector(`[data-stock="${button.dataset.saveStock}"]`);try{await api(`/api/stores/${slug}/corporate/products/${button.dataset.saveStock}/stock`,{method:'PATCH',body:JSON.stringify({stock:Number(input.value)})});toast('Estoque atualizado.');}catch(error){toast(error.message,'error');}}); } catch(error){toast(error.message,'error');}
    return;
  }
  const globalScope = state.user.role === 'admin';
  renderCorporateWorkspace(page,titles[page],`<section class="workspace-panel"><div class="notice-panel"><h2>${page==='payments'?'Visão financeira':'Controle de logins e permissões'}</h2><p>${globalScope ? 'Acesso administrativo global aos dados de todas as organizações.' : `Acesso restrito aos dados da organização ${escapeHtml(state.store.name)}.`}</p></div></section>`);
}
async function exportParameterSpreadsheet(filename,heading,values){
  const {default:ExcelJS}=await import('exceljs');
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet(heading);
  sheet.addRow([heading]);
  values.forEach(value=>sheet.addRow([value]));
  sheet.getColumn(1).width=Math.max(20,...values.map(value=>String(value).length+2));
  const buffer=await workbook.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);
}
async function importParameterSpreadsheet(file,heading,normalize,createItem){
  const {default:ExcelJS}=await import('exceljs');
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet=workbook.worksheets[0];
  if(!sheet)throw new Error('A planilha não possui uma página válida.');
  const values=[];
  sheet.eachRow(row=>{const value=normalize(row.getCell(1).text);if(value&&value!==normalize(heading)&&!values.includes(value))values.push(value);});
  if(!values.length)throw new Error('A primeira coluna não possui itens para importar.');
  for(const value of values)await createItem(value);
  return values.length;
}
function setParameterEditing(article,editing){
  const input=article.querySelector('input');
  input.disabled=!editing;
  article.querySelector('[data-edit]').hidden=editing;
  article.querySelector('[data-save-edit]').hidden=!editing;
  article.querySelector('[data-cancel-edit]').hidden=!editing;
  if(editing){input.dataset.original=input.value;input.focus();input.select();}
}
function openParameterCreateDialog({title,placeholder,caseMode,onSave}){
  const overlay=document.createElement('div');
  overlay.className='mini-modal-overlay';
  overlay.innerHTML=`<section class="mini-modal" role="dialog" aria-modal="true"><button class="close mini-modal-close" type="button" aria-label="Fechar">×</button><h3>${escapeHtml(title)}</h3><form><label>${escapeHtml(title)}<input name="name" maxlength="50" placeholder="${escapeHtml(placeholder)}" required></label><div class="mini-modal-actions"><button class="secondary" data-mini-cancel type="button">Cancelar</button><button class="highlight-action" type="submit">Salvar</button></div><p class="form-error"></p></form></section>`;
  $('#modal-root').append(overlay);
  const close=()=>overlay.remove();
  overlay.querySelector('.mini-modal-close').onclick=close;
  overlay.querySelector('[data-mini-cancel]').onclick=close;
  overlay.onclick=event=>{if(event.target===overlay)close();};
  const input=overlay.querySelector('input');
  input.addEventListener('input',()=>{input.value=caseMode==='upper'?input.value.toLocaleUpperCase('pt-BR'):input.value.toLocaleLowerCase('pt-BR');});
  overlay.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]');button.disabled=true;try{await onSave(input.value);}catch(error){overlay.querySelector('.form-error').textContent=error.message;button.disabled=false;}};
  input.focus();
}
async function openCategoryManager(){
  let items;
  try{items=(await api(`/api/stores/${slug}/corporate/categories`)).categories;}catch(error){return toast(error.message,'error');}
  modal(`<div class="manager-modal-header"><div><span class="kicker">ÁREA CORPORATIVA</span><h2>Gerenciar Categorias</h2><p class="muted">Categorias em letras maiúsculas. O XLSX usa somente a primeira coluna.</p></div><div class="parameter-toolbar"><label class="parameter-secondary import-parameter">Importar XLSX<input id="import-categories" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><button class="parameter-secondary" id="export-categories" type="button">Exportar XLSX</button><button class="highlight-action" id="show-add-category" type="button">Adicionar Categoria</button></div></div><div class="parameter-list category-list">${items.map(item=>`<article data-category-row="${item.id}"><input value="${escapeHtml(item.name)}" maxlength="50" data-category-name="${item.id}" disabled><div class="parameter-edit-actions"><button data-edit type="button">Editar</button><button class="highlight-action" data-save-edit type="button" hidden>Salvar Edição</button><button class="secondary" data-cancel-edit type="button" hidden>Cancelar Edição</button><button class="danger" data-delete-category="${item.id}" type="button">Excluir</button></div></article>`).join('')||'<p class="muted">Nenhuma categoria cadastrada.</p>'}</div>`,'manager-modal');
  $('#show-add-category').onclick=()=>openParameterCreateDialog({title:'Adicionar Categoria',placeholder:'Ex.: ALIMENTOS',caseMode:'upper',onSave:async name=>{await api(`/api/stores/${slug}/corporate/categories`,{method:'POST',body:JSON.stringify({name})});await openCategoryManager();toast('Categoria adicionada.');}});
  document.querySelectorAll('[data-category-name]').forEach(input=>input.addEventListener('input',()=>{input.value=input.value.toLocaleUpperCase('pt-BR');}));
  $('#export-categories').onclick=()=>exportParameterSpreadsheet('categorias.xlsx','CATEGORIA',items.map(item=>item.name));
  $('#import-categories').onchange=async event=>{const file=event.currentTarget.files?.[0];if(!file)return;try{const count=await importParameterSpreadsheet(file,'CATEGORIA',value=>String(value||'').trim().toLocaleUpperCase('pt-BR'),name=>api(`/api/stores/${slug}/corporate/categories`,{method:'POST',body:JSON.stringify({name})}));await openCategoryManager();toast(`${count} categoria(s) importada(s).`);}catch(error){toast(error.message,'error');}};
  document.querySelectorAll('[data-category-row]').forEach(article=>{
    article.querySelector('[data-edit]').onclick=()=>setParameterEditing(article,true);
    article.querySelector('[data-cancel-edit]').onclick=()=>{article.querySelector('input').value=article.querySelector('input').dataset.original;setParameterEditing(article,false);};
    article.querySelector('[data-save-edit]').onclick=async()=>{const input=article.querySelector('input');try{await api(`/api/stores/${slug}/corporate/categories/${article.dataset.categoryRow}`,{method:'PATCH',body:JSON.stringify({name:input.value})});await openCategoryManager();toast('Edição da categoria salva.');}catch(error){toast(error.message,'error');}};
  });
  document.querySelectorAll('[data-delete-category]').forEach(button=>button.onclick=async()=>{if(!confirm('Excluir esta categoria?'))return;try{await api(`/api/stores/${slug}/corporate/categories/${button.dataset.deleteCategory}`,{method:'DELETE'});await openCategoryManager();toast('Categoria excluída.');}catch(error){toast(error.message,'error');}});
}
async function openMeasurementUnitManager(){
  let items;
  try{items=(await api(`/api/stores/${slug}/corporate/measurement-units`)).units;}catch(error){return toast(error.message,'error');}
  modal(`<div class="manager-modal-header"><div><span class="kicker">ÁREA CORPORATIVA</span><h2>Gerenciar Unidade de Medidas</h2><p class="muted">Use minúsculas: gramas, g, unidade ou und. O XLSX usa somente a primeira coluna.</p></div><div class="parameter-toolbar"><label class="parameter-secondary import-parameter">Importar XLSX<input id="import-units" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><button class="parameter-secondary" id="export-units" type="button">Exportar XLSX</button><button class="highlight-action" id="show-add-unit" type="button">Adicionar Unidade</button></div></div><div class="parameter-list measurement-unit-list">${items.map(item=>`<article data-unit-row="${item.id}"><input value="${escapeHtml(item.name)}" maxlength="30" data-unit-name="${item.id}" disabled><div class="parameter-edit-actions"><button data-edit type="button">Editar</button><button class="highlight-action" data-save-edit type="button" hidden>Salvar Edição</button><button class="secondary" data-cancel-edit type="button" hidden>Cancelar Edição</button><button class="danger" data-delete-unit="${item.id}" type="button">Excluir</button></div></article>`).join('')||'<p class="muted">Nenhuma unidade de medida cadastrada.</p>'}</div>`,'manager-modal');
  $('#show-add-unit').onclick=()=>openParameterCreateDialog({title:'Adicionar Unidade',placeholder:'Ex.: gramas, g, unidade ou und',caseMode:'lower',onSave:async name=>{await api(`/api/stores/${slug}/corporate/measurement-units`,{method:'POST',body:JSON.stringify({name})});await openMeasurementUnitManager();toast('Unidade de medida adicionada.');}});
  document.querySelectorAll('[data-unit-name]').forEach(input=>input.addEventListener('input',()=>{input.value=input.value.toLocaleLowerCase('pt-BR');}));
  $('#export-units').onclick=()=>exportParameterSpreadsheet('unidades-de-medida.xlsx','UNIDADE DE MEDIDA',items.map(item=>item.name));
  $('#import-units').onchange=async event=>{const file=event.currentTarget.files?.[0];if(!file)return;try{const count=await importParameterSpreadsheet(file,'UNIDADE DE MEDIDA',value=>String(value||'').trim().toLocaleLowerCase('pt-BR'),name=>api(`/api/stores/${slug}/corporate/measurement-units`,{method:'POST',body:JSON.stringify({name})}));await openMeasurementUnitManager();toast(`${count} unidade(s) importada(s).`);}catch(error){toast(error.message,'error');}};
  document.querySelectorAll('[data-unit-row]').forEach(article=>{
    article.querySelector('[data-edit]').onclick=()=>setParameterEditing(article,true);
    article.querySelector('[data-cancel-edit]').onclick=()=>{article.querySelector('input').value=article.querySelector('input').dataset.original;setParameterEditing(article,false);};
    article.querySelector('[data-save-edit]').onclick=async()=>{const input=article.querySelector('input');try{await api(`/api/stores/${slug}/corporate/measurement-units/${article.dataset.unitRow}`,{method:'PATCH',body:JSON.stringify({name:input.value})});await openMeasurementUnitManager();toast('Edição da unidade salva.');}catch(error){toast(error.message,'error');}};
  });
  document.querySelectorAll('[data-delete-unit]').forEach(button=>button.onclick=async()=>{if(!confirm('Excluir esta unidade de medida?'))return;try{await api(`/api/stores/${slug}/corporate/measurement-units/${button.dataset.deleteUnit}`,{method:'DELETE'});await openMeasurementUnitManager();toast('Unidade de medida excluída.');}catch(error){toast(error.message,'error');}});
}
function openCart() {
  const items=cartItems(); modal(`<span class="kicker">SEU CARRINHO</span><h2>${items.length ? `${items.length} ${items.length===1?'produto':'produtos'}` : 'Carrinho vazio'}</h2><div class="cart-list">${items.map(i=>`<div class="cart-item"><div class="cart-thumb" style="--art:${i.color}">${icon(i.icon,38)}</div><div><strong>${escapeHtml(i.name)}</strong><small>${money(i.price)}</small><div class="qty"><button data-minus="${i.id}">−</button><span>${i.quantity}</span><button data-plus="${i.id}">+</button></div></div><button class="remove" data-remove="${i.id}" aria-label="Remover">×</button></div>`).join('') || '<p class="muted">Adicione produtos para começar.</p>'}</div>${items.length?`<div class="cart-total"><span>Total</span><strong>${money(total())}</strong></div><button class="primary full" id="checkout">Continuar para pagamento</button>`:''}`, 'cart-modal');
  document.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{ if(--state.cart[b.dataset.minus]<=0)delete state.cart[b.dataset.minus];saveCart();openCart();}); document.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{state.cart[b.dataset.plus]++;saveCart();openCart();}); document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete state.cart[b.dataset.remove];saveCart();openCart();}); $('#checkout')?.addEventListener('click',()=> state.user ? openCheckout() : openLogin(openCheckout));
}
function openCheckout() {
  modal(`<span class="kicker">CHECKOUT SEGURO</span><h2>Finalizar pedido</h2><form id="checkout-form"><div class="checkout-grid"><label>Nome completo<input name="name" value="${escapeHtml(state.user.name)}" required></label><label>CPF ou CNPJ<input name="cpfCnpj" inputmode="numeric" placeholder="000.000.000-00" required></label><label>Celular<input name="phone" type="tel" placeholder="(00) 00000-0000" required></label></div><h3>Forma de pagamento</h3><div class="pay-options"><label><input type="radio" name="method" value="pix" checked><span><b>PIX</b><small>Aprovação rápida</small></span></label><label><input type="radio" name="method" value="card"><span><b>Cartão</b><small>Crédito à vista</small></span></label></div><div id="card-fields" class="card-fields" hidden><label>Nome no cartão<input name="holderName"></label><label>Número do cartão<input name="number" inputmode="numeric"></label><label>Validade<input name="expiry" placeholder="MM/AAAA"></label><label>CVV<input name="ccv" inputmode="numeric"></label><label>CEP<input name="postalCode" inputmode="numeric"></label><label>Número do endereço<input name="addressNumber"></label></div><div class="cart-total"><span>Total</span><strong>${money(total())}</strong></div><button class="primary full" type="submit">Pagar ${money(total())}</button><p class="form-error"></p></form>`, 'checkout-modal');
  document.querySelectorAll('[name=method]').forEach(r=>r.onchange=()=>{$('#card-fields').hidden=r.value!=='card';});
  $('#checkout-form').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Processando com segurança...';const f=Object.fromEntries(new FormData(e.target));const [expiryMonth,expiryYear]=String(f.expiry||'').split('/');try{const data=await api(`/api/stores/${slug}/orders`,{method:'POST',body:JSON.stringify({items:cartItems().map(i=>({productId:i.id,quantity:i.quantity})),method:f.method,customer:{name:f.name,cpfCnpj:f.cpfCnpj,phone:f.phone},card:{holderName:f.holderName,number:f.number,expiryMonth,expiryYear,ccv:f.ccv,postalCode:f.postalCode,addressNumber:f.addressNumber}})});state.cart={};saveCart();showPayment(data.order);}catch(error){$('.form-error').textContent=error.message;btn.disabled=false;btn.textContent=`Pagar ${money(total())}`;}};
}
function showPayment(order) { const p=order.payment; modal(`<div class="success-icon">${p.status==='CONFIRMED'?'✓':'◇'}</div><span class="kicker">PEDIDO ${escapeHtml(order.id)}</span><h2>${p.status==='CONFIRMED'?'Pagamento aprovado!':'Agora é só pagar o PIX'}</h2>${p.method==='pix'?`<p class="muted">Copie o código abaixo e pague no aplicativo do seu banco.</p>${p.pix?.encodedImage?`<img class="qr" src="data:image/png;base64,${p.pix.encodedImage}" alt="QR Code PIX">`:''}<div class="pix-code">${escapeHtml(p.pix?.payload||'')}</div><button class="primary full" id="copy-pix">Copiar código PIX</button>`:`<p class="muted">Seu pedido foi confirmado e já está sendo preparado.</p>`}<button class="text-button full" id="finish">Voltar para a loja</button>`, 'result-modal'); $('#copy-pix')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(p.pix.payload);toast('Código PIX copiado.');});$('#finish').onclick=closeModal; }
async function showOrders(){try{const data=await api(`/api/stores/${slug}/orders`);modal(`<span class="kicker">MINHA CONTA</span><h2>Meus pedidos</h2><div class="orders">${data.orders.map(o=>`<article><div><strong>${escapeHtml(o.id)}</strong><small>${new Date(o.createdAt).toLocaleDateString('pt-BR')}</small></div><span class="status">${escapeHtml(o.status.replaceAll('_',' '))}</span><b>${money(o.total)}</b></article>`).join('')||'<p class="muted">Você ainda não fez pedidos.</p>'}</div>`);}catch(e){toast(e.message,'error');}}

async function init(){try{await loadSystemConfig();}catch(error){document.title='Configuração indisponível';$('#app').innerHTML=`<main class="not-found"><div><span>!</span><h1>Configuração indisponível</h1><p>${escapeHtml(error.message)}</p></div></main>`;return;}if(!slug)return renderPortal();try{const data=await api(`/api/stores/${slug}`);state.store=data.store;renderApp();if(state.token){try{const session=await api(`/api/stores/${slug}/session`);state.user=session.user;}catch{state.token='';state.user=null;sessionStorage.removeItem(`token:${slug}`);sessionStorage.removeItem(`user:${slug}`);}renderApp();}}catch(error){$('#app').innerHTML=`<main class="not-found"><div><span>404</span><h1>Loja não encontrada</h1><p>Confira o endereço informado. Cada organização possui seu próprio link.</p><a href="${import.meta.env.BASE_URL}">Ir para o portal ${escapeHtml(systemConfig.name)}</a></div></main>`;}}
init();
