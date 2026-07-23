import './style.css';
import { icon } from './icons.js';

const DEFAULT_API = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://lojasite-back.onrender.com';
const API = (import.meta.env.VITE_API_URL || DEFAULT_API).replace(/\/$/, '');
const pathSegments = location.pathname.split('/').filter(Boolean);
const repositoryBase = String(import.meta.env.BASE_URL || '/').split('/').filter(Boolean)[0]?.toLowerCase();
const slug = (pathSegments[0]?.toLowerCase() === repositoryBase ? pathSegments[1] : pathSegments[0])?.toLowerCase() || '';
const state = { store: null, cart: JSON.parse(localStorage.getItem(`cart:${slug}`) || '{}'), token: sessionStorage.getItem(`token:${slug}`) || '', user: JSON.parse(sessionStorage.getItem(`user:${slug}`) || 'null'), category: 'Todos', query: '', productsExpanded: false, productCarouselTimer: null };
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escapeHtml = value => { const el = document.createElement('span'); el.textContent = String(value ?? ''); return el.innerHTML; };

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
  return `<article class="product-card"><div class="product-art" style="--art:${product.color}"><span class="product-tag">${escapeHtml(product.category)}</span>${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">` : icon(product.icon, 72)}</div><div class="product-info"><h3>${escapeHtml(product.name)}</h3>${descriptionElement}<div class="product-buy"><div>${product.oldPrice ? `<s>${money(product.oldPrice)}</s>` : ''}<strong>${money(product.price)}</strong></div><button class="add" data-add="${product.id}" aria-label="Adicionar ${escapeHtml(product.name)}">${icon('bag',20)}<span>Adicionar</span></button></div></div></article>`;
}
function renderProducts() {
  clearInterval(state.productCarouselTimer);
  const products = state.store.products.filter(p => (state.category === 'Todos' || p.category === state.category) && `${p.name} ${p.description}`.toLowerCase().includes(state.query.toLowerCase()));
  const visibleProducts = state.productsExpanded ? products : products.slice(0, 6);
  $('#products').classList.toggle('expanded', state.productsExpanded);
  $('#products').innerHTML = visibleProducts.length ? visibleProducts.map(productCard).join('') : '<div class="empty"><h3>Nenhum produto encontrado</h3><p>Tente outro termo ou categoria.</p></div>';
  const moreButton = $('#more-products');
  if (moreButton) {
    moreButton.hidden = products.length <= 6;
    moreButton.textContent = state.productsExpanded ? 'Menos Produtos' : `Mais Produtos (${products.length - 6})`;
    moreButton.setAttribute('aria-expanded', String(state.productsExpanded));
  }
  document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => { state.cart[btn.dataset.add] = (state.cart[btn.dataset.add] || 0) + 1; saveCart(); toast('Produto adicionado ao carrinho.'); btn.classList.add('added'); setTimeout(() => btn.classList.remove('added'), 500); });
  document.querySelectorAll('[data-product-description]').forEach(button=>button.onclick=()=>{const product=state.store.products.find(item=>item.id===button.dataset.productDescription);if(product)openProductDescription(product);});
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
    $('#produtos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
function startProductCarousel(){
  const carousel=$('#products');
  if(!carousel||carousel.scrollHeight<=carousel.clientHeight+2)return;
  const start=()=>{clearInterval(state.productCarouselTimer);state.productCarouselTimer=setInterval(()=>{if(!carousel.isConnected)return clearInterval(state.productCarouselTimer);const firstCard=carousel.querySelector('.product-card');const step=(firstCard?.offsetHeight||280)+24;const atEnd=carousel.scrollTop+carousel.clientHeight>=carousel.scrollHeight-8;carousel.scrollTo({top:atEnd?0:carousel.scrollTop+step,behavior:'smooth'});},3200);};
  const pause=()=>clearInterval(state.productCarouselTimer);
  carousel.addEventListener('mouseenter',pause);carousel.addEventListener('mouseleave',start);carousel.addEventListener('touchstart',pause,{passive:true});carousel.addEventListener('touchend',start,{passive:true});
  start();
}
function openProductDescription(product){modal(`<span class="kicker">${escapeHtml(product.category)}</span><h2>${escapeHtml(product.name)}</h2><div class="description-content">${escapeHtml(product.description)}</div>`,'description-modal');}
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
  const mapLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
  const directionsLink = address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving` : '';
  const generatedMapUrl = address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : '';
  const contactItems = [info.phone ? `<a href="tel:${escapeHtml(info.phone.replace(/[^\d+]/g,''))}"><b>Telefone</b><span>${escapeHtml(info.phone)}</span></a>` : '', info.whatsapp ? `<a href="https://wa.me/${escapeHtml(info.whatsapp)}" target="_blank" rel="noopener"><b>WhatsApp</b><span>${escapeHtml(info.whatsapp)}</span></a>` : '', info.email ? `<a href="mailto:${escapeHtml(info.email)}"><b>E-mail</b><span>${escapeHtml(info.email)}</span></a>` : '', info.hours ? `<div><b>Horário</b><span>${escapeHtml(info.hours)}</span></div>` : ''].join('');
  $('#app').innerHTML = `<header class="header store-header"><a class="logo store-logo store-logo-only" href="${import.meta.env.BASE_URL}${slug}" aria-label="${escapeHtml(store.name)}"><img id="store-logo-image" src="${import.meta.env.BASE_URL}imagens/${store.id}/logo.png" alt="Logo ${escapeHtml(store.name)}"></a><nav class="store-nav" aria-label="Seções da loja"><a href="#novidades">NOVIDADES</a><a href="#produtos">PRODUTOS</a><a href="#nossa-loja">NOSSA LOJA</a></nav><div class="header-search-wrap"><label class="header-search">⌕<input id="header-search" value="${escapeHtml(state.query)}" autocomplete="off" placeholder="Pesquisar produtos" aria-label="Pesquisar produtos" aria-controls="search-suggestions"></label><div class="search-suggestions" id="search-suggestions" hidden></div></div><div class="header-actions">${state.user ? `<div class="user-menu-wrap"><button class="logged-user" id="user-menu-button" aria-label="Abrir menu de ${escapeHtml(state.user.name)}" aria-expanded="false"><span class="user-avatar">${userAvatar}</span><span class="logged-user-name">${escapeHtml(state.user.name)}</span><b>⋮</b></button><nav class="user-menu" id="user-menu" hidden><strong>${escapeHtml(state.user.name)}</strong><small>${escapeHtml(state.user.cargo || '')}</small>${staff ? `<button data-corporate="stock">Estoque</button>${manager ? `<button data-corporate="payments">Sistema de Pagamento</button><button data-corporate="access">Gestão de Logins</button>` : ''}` : `<button id="account">Dados Cadastrais</button><button id="payment-data">Dados de Pagamento</button><button id="orders-menu">Minhas Compras</button>`}<button id="logout-menu">Sair</button></nav></div>` : `<button class="login-button" id="login">Entrar</button>`}<button class="cart-button" id="cart" aria-label="Abrir carrinho">${icon('bag',22)}<span>Carrinho</span><b id="cart-count" hidden>0</b></button></div></header>
  <main><section class="hero" id="novidades"><div class="hero-copy"><span class="kicker">NOVIDADES</span><h1>${escapeHtml(store.tagline)}</h1><p>Escolhas especiais, compra segura e entrega para todo o Brasil.</p><a href="#produtos">Ver produtos <span>↗</span></a></div>${heroVisual}</section>
  <section class="catalog" id="produtos"><div class="section-head"><div><span class="kicker">NOSSA SELEÇÃO</span><h2>Produtos em destaque</h2></div><button class="more-products" id="more-products" type="button" aria-expanded="false">Mais Produtos</button></div><div class="catalog-browser"><aside class="category-panel"><h3>Categorias</h3><div class="category-navigation" aria-label="Categorias">${categories.map(category=>`<button data-category="${escapeHtml(category)}" class="${state.category===category?'active':''}">${category==='Todos'?'Todas as Categorias':escapeHtml(category)}</button>`).join('')}</div></aside><div class="product-grid" id="products"></div></div></section>
  <section class="store-about" id="nossa-loja"><div class="store-about-copy"><span class="kicker">NOSSA LOJA</span><h2>${escapeHtml(store.name)}</h2><p>${escapeHtml(info.description || store.tagline)}</p>${address ? `<div class="store-address"><b>Endereço</b><span>${escapeHtml(address)}</span><div class="store-route-actions"><a href="${mapLink}" target="_blank" rel="noopener">Abrir no mapa</a><a class="route-highlight" href="${directionsLink}" target="_blank" rel="noopener">Como Chegar</a></div></div>` : ''}<div class="store-contacts">${contactItems || '<p>Informações de contato serão publicadas em breve.</p>'}</div></div><div class="store-map">${info.mapUrl || generatedMapUrl ? `<iframe src="${escapeHtml(info.mapUrl || generatedMapUrl)}" title="Mapa de ${escapeHtml(store.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div><strong>Mapa em preparação</strong><span>O endereço desta loja será publicado em breve.</span></div>'}</div><footer class="portal-simple-footer organization-footer"><span class="footer-system-logo"><img src="${import.meta.env.BASE_URL}imagens/logo.png" alt="Logo LojaSite"></span><button class="footer-developer" id="developer-contact" type="button" aria-label="Abrir contatos de suporte da EVOTECHUB"><img src="${import.meta.env.BASE_URL}imagens/logo_dev.png" alt="Logo EVOTECHUB"><span>© EVOTECHUB 2026 - Todos os direitos reservados.</span></button></footer></section></main>`;
  updateCartBadge(); renderProducts();
  const logoImage = $('#store-logo-image'); logoImage.onerror = () => { if (!logoImage.dataset.jpgTried) { logoImage.dataset.jpgTried = 'true'; logoImage.src = `${import.meta.env.BASE_URL}imagens/${store.id}/logo.jpg`; return; } logoImage.hidden = true; };
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
      ? `<a class="contact-action" href="mailto:${escapeHtml(contact.supportEmail)}">${escapeHtml(contact.supportEmail)}</a>`
      : '<span class="muted">E-mail indisponível</span>';
    const whatsapp = contact.supportWhatsapp
      ? `<a class="contact-action whatsapp" href="https://wa.me/${contact.supportWhatsapp}" target="_blank" rel="noopener">Falar com o suporte pelo WhatsApp</a>`
      : '<span class="muted">WhatsApp indisponível</span>';
    modal(`<div class="developer-contact-modal"><img src="${import.meta.env.BASE_URL}imagens/logo_dev.png" alt="Logo EVOTECHUB"><span class="kicker">SUPORTE DAS LOJAS</span><h2>Fale com a EVOTECHUB</h2><div class="developer-contact-actions">${email}${whatsapp}</div></div>`, 'developer-modal');
  } catch (error) { toast(error.message, 'error'); }
}

async function loadPublicContacts() {
  try {
    const contact = await api('/api/public/contact');
    document.querySelectorAll('[data-support-email]').forEach(element => { if (!contact.supportEmail) return; element.textContent = contact.supportEmail; element.href = `mailto:${contact.supportEmail}`; element.hidden = false; });
    document.querySelectorAll('[data-whatsapp]').forEach(element => { if (!contact.newStoreWhatsapp) return; element.href = `https://wa.me/${contact.newStoreWhatsapp}?text=${encodeURIComponent('Olá! Quero adquirir minha LojaSite.')}`; element.hidden = false; });
    document.querySelectorAll('[data-new-store-email]').forEach(element => { if (!contact.newStoreEmail) return; element.href = `mailto:${contact.newStoreEmail}?subject=${encodeURIComponent('Quero adquirir minha LojaSite')}`; element.hidden = false; });
  } catch { /* Os contatos não impedem o uso da loja. */ }
}

function renderPortal() {
  document.title = 'LojaSite · Lojas online para organizações';
  document.documentElement.style.setProperty('--primary', '#176bff');
  document.documentElement.style.setProperty('--accent', '#70e1c0');
  $('#app').innerHTML = `<div class="portal"><header class="header portal-header"><a class="logo portal-logo portal-logo-only" href="${import.meta.env.BASE_URL}" aria-label="LojaSite"><img src="${import.meta.env.BASE_URL}imagens/logo.png" alt="Logo LojaSite"></a><nav><a href="#como-funciona">Como funciona</a><a href="#manual">Manual</a><a href="#contato">Contato</a></nav><a class="portal-access" href="#acessar">Acessar uma loja</a></header>
  <main><section class="portal-hero"><div><span class="kicker">SUA LOJA, SEU ENDEREÇO, SUAS VENDAS</span><h1>Transforme seu estoque em uma loja online.</h1><p>Tenha um mostruário profissional, organize produtos e venda pelo próprio site — com uma experiência segura, prática e feita para o seu negócio.</p><a class="portal-primary" href="#recursos">Conhecer a LojaSite <span>↓</span></a></div><div class="portal-window"><div class="window-bar"><i></i><i></i><i></i><small>lojasite.com.br/sua-loja</small></div><div class="window-content"><span>LS</span><div><small>SEU NEGÓCIO ONLINE</small><strong>Estoque, vitrine e vendas em <b>um só lugar</b></strong></div></div></div></section>
  <section class="portal-section" id="recursos"><div class="portal-title"><span class="kicker">MAIS QUE UM MOSTRUÁRIO</span><h2>Tudo para apresentar e vender seus produtos.</h2><p>Crie uma presença digital própria sem depender apenas de redes sociais ou marketplaces.</p></div><div class="steps business-features"><article><b>01</b><h3>Controle de estoque</h3><p>Organize seus produtos e mantenha sua operação preparada para novas vendas.</p></article><article><b>02</b><h3>Mostruário online</h3><p>Apresente seu catálogo em uma vitrine profissional, disponível todos os dias.</p></article><article><b>03</b><h3>Venda pelo site</h3><p>Receba pedidos e permita que o cliente finalize a compra dentro da própria loja.</p></article><article><b>04</b><h3>Ordem pelo WhatsApp</h3><p>Encaminhe a ordem de serviço pelo WhatsApp e conduza o cliente até a finalização.</p></article></div></section>
  <section class="portal-section" id="como-funciona"><div class="portal-title"><span class="kicker">SEGURO E PRÁTICO</span><h2>Uma loja própria para cada negócio.</h2><p>Cada organização recebe um endereço exclusivo, identidade visual própria e acesso protegido. O cliente encontra os produtos rapidamente e compra do jeito que preferir.</p></div><div class="steps"><article><b>01</b><h3>Seu endereço</h3><p>Uma URL exclusiva identifica sua loja automaticamente.</p></article><article><b>02</b><h3>Seu catálogo</h3><p>Produtos e informações ficam organizados em uma vitrine fácil de navegar.</p></article><article><b>03</b><h3>Suas vendas</h3><p>Finalize online ou continue o atendimento por ordem de serviço no WhatsApp.</p></article></div></section>
  <section class="portal-section portal-manual" id="manual"><div class="portal-title"><span class="kicker">MANUAL RÁPIDO</span><h2>Comece em poucos passos.</h2></div><div class="manual-grid"><div><h3>Para clientes</h3><ol><li>Acesse o link fornecido pela organização.</li><li>Escolha os produtos e abra o carrinho.</li><li>Entre com seu login e senha.</li><li>Informe os dados e selecione PIX ou cartão.</li><li>Acompanhe o pedido em “Minha conta”.</li></ol></div><div><h3>Endereço personalizado</h3><p>O sufixo é escolhido em comum acordo com cada organização. Por exemplo, “Lojão da Noruega” poderia usar:</p><div class="link-example">lojasite.com.br/<strong>lojao_da_noruega</strong></div><p>Use sempre o endereço oficial recebido. Por privacidade, o portal não divulga a relação de organizações atendidas.</p></div></div></section>
  <section class="portal-contact" id="contato"><div><span class="kicker">SUPORTE E DESENVOLVIMENTO</span><h2>Precisa de ajuda?</h2><p>Fale com o suporte técnico para tirar dúvidas sobre acesso e utilização do sistema.</p></div><a data-support-email hidden></a></section>
  <section class="acquire-store"><div><span class="kicker">COMECE A VENDER ONLINE</span><h2>Quero adquirir minha LojaSite</h2><p>Tenha sua própria loja online com endereço exclusivo, catálogo, estoque e vendas integradas ao seu atendimento.</p></div><div class="acquire-actions"><a class="email-button" data-new-store-email hidden>Enviar e-mail <span>↗</span></a><a class="whatsapp-button" data-whatsapp hidden>Falar pelo WhatsApp <span>↗</span></a></div></section>
  <section class="portal-access-section" id="acessar"><span class="kicker">ACESSO À SUA LOJA</span><h2>Informe o sufixo do seu link</h2><form id="portal-access-form"><span>lojasite.com.br/</span><input name="suffix" placeholder="sua_organizacao" pattern="[a-zA-Z0-9_-]+" required><button type="submit">Acessar</button></form><p>O sufixo é fornecido pela sua organização.</p></section></main>
  <footer class="portal-simple-footer"><img src="${import.meta.env.BASE_URL}imagens/logo_dev.png" alt="Logo EVOTECHUB"><span>© EVOTECHUB 2026 - Todos os direitos reservados.</span></footer></div>`;
  $('#portal-access-form').onsubmit = event => { event.preventDefault(); const suffix = new FormData(event.currentTarget).get('suffix').trim().toLowerCase(); location.href = `${import.meta.env.BASE_URL}${encodeURIComponent(suffix)}`; };
  loadPublicContacts();
}
function openLogin(next) {
  modal(`<div class="login-system-logo"><img src="${import.meta.env.BASE_URL}imagens/logo.png" alt="Logo LojaSite"></div><span class="kicker">ÁREA DE ACESSO</span><h2>Bom ter você aqui</h2><p class="muted">Entre com seu login e senha para acessar sua conta.</p><form id="login-form"><label>Login<input name="login" autocomplete="username" placeholder="Seu login" required></label><label>Senha<input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" minlength="6" required></label><label class="show-password"><input id="show-password" type="checkbox"> <span>Exibir senha</span></label><button class="primary full" type="submit">Entrar</button><p class="form-error" aria-live="polite"></p></form>`, 'login-modal');
  $('#show-password').onchange = event => { $('#login-password').type = event.currentTarget.checked ? 'text' : 'password'; };
  $('#login-form').onsubmit = async e => { e.preventDefault(); const btn=e.target.querySelector('button'); btn.disabled=true; btn.textContent='Entrando...'; try { const body=Object.fromEntries(new FormData(e.target)); const data=await api(`/api/stores/${slug}/auth/login`,{method:'POST',body:JSON.stringify(body)}); state.token=data.token; state.user=data.user; sessionStorage.setItem(`token:${slug}`,data.token); sessionStorage.setItem(`user:${slug}`,JSON.stringify(data.user)); closeModal(); renderApp(); toast('Login realizado com sucesso.'); if(typeof next === 'function') next(); } catch(error){ const errorElement=$('.form-error'); if(errorElement){errorElement.textContent=error.message;btn.disabled=false;btn.textContent='Entrar';}else{toast(error.message,'error');} } };
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
    modal(`<span class="kicker">ÁREA CORPORATIVA</span><h2>${titles[page]}</h2><p class="muted">Cadastre um produto real no catálogo da organização.</p><form id="product-form"><div class="checkout-grid"><label>Nome *<input name="name" required></label><label>Categoria *<select name="category" required><option value="">Selecione</option>${categoryItems.map(item=>`<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Preço (R$) *<input name="price" id="product-price" type="text" inputmode="numeric" placeholder="0,00" required></label><label>Quantidade *<input name="stock" type="text" inputmode="numeric" pattern="[0-9]+" placeholder="Ex.: 10" required></label><label>Medida por unidade *<input name="measurementQuantity" type="number" min="0.001" step="0.001" placeholder="Ex.: 750" required></label>${manualMeasurementUnit?'<label>Unidade de medida *<input name="measurementUnit" maxlength="30" placeholder="Ex.: gramas, g, unidade ou und" required></label>':`<label>Unidade de medida *<select name="measurementUnitId" required><option value="">Selecione</option>${unitItems.map(item=>`<option value="${escapeHtml(item.id)}" data-unit="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}</select></label>`}<label class="barcode-field">Código de Barras *<input name="barcode" type="text" inputmode="numeric" pattern="[0-9]{4,32}" minlength="4" maxlength="32" placeholder="Leia ou digite o código" required></label><label class="wide product-description-field">Descrição<textarea name="description" placeholder="Descreva o produto"></textarea></label><div class="wide product-photo-field"><strong>Imagem do produto</strong><div id="product-photo-preview">Nenhuma imagem selecionada</div><div class="photo-actions"><label class="photo-picker">Escolher foto<input class="product-photo-input" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="photo-picker">Tirar foto<input class="product-photo-input" type="file" accept="image/png,image/jpeg,image/webp" capture="environment"></label></div><small>JPG, PNG ou WEBP de até 4 MB.</small></div></div><button class="primary full product-submit" type="submit" disabled>Cadastrar Produto</button><p class="form-error"></p></form>`, 'corporate-modal product-modal');
    const productForm=$('#product-form'),productSubmit=productForm.querySelector('[type=submit]'),stockInput=productForm.elements.stock,barcodeInput=productForm.elements.barcode;
    const updateProductSubmit=()=>{const validPrice=parseBrazilianPrice(productForm.elements.price.value)>0;productSubmit.disabled=!(productForm.checkValidity()&&validPrice);};
    stockInput.addEventListener('input',()=>{stockInput.value=stockInput.value.replace(/\D/g,'');updateProductSubmit();});
    barcodeInput.addEventListener('input',()=>{barcodeInput.value=barcodeInput.value.replace(/\D/g,'');updateProductSubmit();});
    productForm.addEventListener('input',updateProductSubmit);productForm.addEventListener('change',updateProductSubmit);
    $('#product-price').oninput=event=>{formatBrazilianPriceInput(event.currentTarget);updateProductSubmit();};
    let productImageData=''; document.querySelectorAll('.product-photo-input').forEach(input=>input.onchange=async event=>{const file=event.currentTarget.files?.[0];if(!file)return;if(file.size>4*1024*1024){event.currentTarget.value='';return toast('A imagem deve ter no máximo 4 MB.','error');}productImageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});$('#product-photo-preview').innerHTML=`<img src="${productImageData}" alt="Pré-visualização do produto">`;});
    productForm.onsubmit = async event => { event.preventDefault(); if(!productForm.checkValidity())return productForm.reportValidity();if(!productImageData&&!await confirmProductWithoutImage())return; productSubmit.disabled=true; try { const body=Object.fromEntries(new FormData(event.currentTarget)); if(!manualMeasurementUnit){const selected=event.currentTarget.elements.measurementUnitId.selectedOptions[0];body.measurementUnit=selected.dataset.unit;delete body.measurementUnitId;}body.imageData=productImageData;body.price=parseBrazilianPrice(body.price);body.stock=Number(body.stock);body.measurementQuantity=Number(body.measurementQuantity);await api(`/api/stores/${slug}/corporate/products`,{method:'POST',body:JSON.stringify(body)});const refreshed=await api(`/api/stores/${slug}`);state.store=refreshed.store;closeModal();renderApp();toast('Produto cadastrado com sucesso.'); } catch(error){$('.form-error').textContent=error.message;updateProductSubmit();} };
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

async function init(){if(!slug)return renderPortal();try{const data=await api(`/api/stores/${slug}`);state.store=data.store;renderApp();if(state.token){try{const session=await api(`/api/stores/${slug}/session`);state.user=session.user;}catch{state.token='';state.user=null;sessionStorage.removeItem(`token:${slug}`);sessionStorage.removeItem(`user:${slug}`);}renderApp();}}catch(error){$('#app').innerHTML=`<main class="not-found"><div><span>404</span><h1>Loja não encontrada</h1><p>Confira o endereço informado. Cada organização possui seu próprio link.</p><a href="${import.meta.env.BASE_URL}">Ir para o portal LojaSite</a></div></main>`;}}
init();
