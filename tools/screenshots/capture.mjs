import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const screenshotsDir = path.join(root, 'docs', 'screenshots');
const imagesDir = path.join(root, 'docs', 'images');
const baseUrl = process.env.TESKERTI_URL || 'http://localhost:3000';
const viewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };
const fakePassword = 'TeskertiDemo!2026';
const fakeCard = '4111 1111 1111 1111';
const expiry = '12/30';
const fakeCvv = '123';
const demoEmail = `demo-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}@example.com`;
const demoUser = {
  firstName: 'Amina',
  lastName: 'Demo',
  email: demoEmail,
  cardHolder: 'AMINA DEMO',
};

await fs.mkdir(screenshotsDir, { recursive: true });
await fs.mkdir(imagesDir, { recursive: true });

function genericImageSvg(url) {
  const params = new URL(url).searchParams;
  const width = Math.min(Number(params.get('w')) || 900, 1920);
  const height = Math.min(Number(params.get('h')) || (width > 1000 ? 900 : 1200), 1920);
  const wide = width > height;
  const titleSize = Math.max(18, Math.round(Math.min(width, height) * 0.055));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#302417"/><stop offset=".48" stop-color="#11100f"/><stop offset="1" stop-color="#080808"/></linearGradient><radialGradient id="glow"><stop stop-color="#f5c518" stop-opacity=".5"/><stop offset="1" stop-color="#f5c518" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/><circle cx="${width * .72}" cy="${height * .36}" r="${Math.min(width,height)*.47}" fill="url(#glow)"/>
    <circle cx="${width * .5}" cy="${height * .4}" r="${Math.min(width,height)*.21}" fill="none" stroke="#f5c518" stroke-opacity=".55" stroke-width="${Math.max(2,width*.006)}"/>
    <circle cx="${width * .5}" cy="${height * .4}" r="${Math.min(width,height)*.1}" fill="none" stroke="#fffbeA" stroke-opacity=".35" stroke-width="${Math.max(2,width*.004)}"/>
    <path d="M ${width*.21} ${height*.82} Q ${width*.5} ${height*.66} ${width*.79} ${height*.82}" fill="none" stroke="#f5c518" stroke-opacity=".8" stroke-width="${Math.max(3,width*.01)}"/>
    <text x="50%" y="${height*.91}" text-anchor="middle" fill="#fffbea" font-family="Arial,sans-serif" font-size="${titleSize}" letter-spacing="${Math.max(3,width*.012)}">${wide ? 'TESKERTI CINEMA' : 'CINEMA TUNISIEN'}</text>
  </svg>`;
}

async function waitForPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach(image => {
      image.loading = 'eager';
    });
  });
  await page.waitForFunction(() => [...document.images].every(image => image.complete), null, { timeout: 15000 });
  await page.waitForTimeout(350);
}

async function screenshot(page, name, options = {}) {
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    animations: 'disabled',
    fullPage: false,
    ...options,
  });
  console.log(`Saved docs/screenshots/${name}`);
}

async function showMoviePosters(page) {
  await page.evaluate(() => {
    const grid = document.querySelector('.movies-grid');
    window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY - 200);
  });
  await page.waitForTimeout(350);
}

async function centerSelectedSeats(page) {
  await page.evaluate(() => {
    const seat = document.querySelector('.seat.selected');
    if (seat) {
      const rect = seat.getBoundingClientRect();
      window.scrollBy(0, rect.top + rect.height / 2 - window.innerHeight / 2);
    }
  });
}

async function waitForHashPage(page, hash, selector) {
  const current = new URL(page.url());
  const target = new URL(baseUrl);
  if (current.origin === target.origin && current.pathname === target.pathname) {
    await page.evaluate(route => {
      const [view, id] = route.split('/');
      window.router.navigate(view, id || null);
    }, hash);
  } else {
    await page.goto(`${baseUrl}/#${hash}`, { waitUntil: 'domcontentloaded' });
  }
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20000 });
  await waitForPage(page);
}

async function applyPromoPresentation(page) {
  await page.evaluate(() => {
    const subtotalLine = document.querySelector('#summary-tickets');
    const amounts = [...(subtotalLine?.querySelectorAll('span:last-child') || [])]
      .map(node => Number.parseFloat(node.textContent.replace(/[^\d.]/g, '')))
      .filter(Number.isFinite);
    const subtotal = amounts.reduce((sum, amount) => sum + amount, 0);
    const discount = Math.round(subtotal * 10) / 100;
    const total = subtotal + 1 - discount;
    document.querySelector('#summary-promo-applied').style.display = 'flex';
    document.querySelector('#summary-promo-text').textContent = 'TESKERTI10 · −10 %';
    document.querySelector('#summary-promo-discount').textContent = `−${discount.toFixed(3)} TND`;
    document.querySelector('#summary-total').textContent = `${total.toFixed(3)} TND`;
    document.querySelector('#btn-pay-amount').textContent = `${total.toFixed(3)} TND`;
  });
}

async function fillPayment(page) {
  await page.locator('#card-number').fill(fakeCard);
  await page.locator('#card-holder').fill(demoUser.cardHolder);
  await page.locator('#card-expiry').fill(expiry);
  await page.locator('#card-cvv').fill(fakeCvv);
  await page.locator('#card-cvv').blur();
  await page.waitForTimeout(350);
}

async function makeQrVisible(page) {
  const reference = await page.locator('#ticket-ref').innerText();
  const qrDataUrl = await QRCode.toDataURL(reference, {
    width: 240,
    margin: 2,
    color: { dark: '#111111', light: '#ffffff' },
  });
  await page.evaluate(src => {
    const container = document.querySelector('#ticket-qr');
    container.innerHTML = '';
    const image = document.createElement('img');
    image.src = src;
    image.alt = 'QR du billet de démonstration';
    image.width = 120;
    image.height = 120;
    image.style.cssText = 'background:#fff;border-radius:4px;padding:4px';
    container.append(image);
  }, qrDataUrl);
  await page.locator('#ticket-qr img').waitFor({ state: 'visible' });
}

async function normalizeTicketTime(page) {
  await page.evaluate(() => {
    const date = document.querySelector('#ticket-date');
    const time = document.querySelector('#ticket-time');
    const parts = date.textContent.split(/\s+a\s+/);
    if (parts.length === 2) {
      date.textContent = parts[0];
      time.textContent = parts[1];
    }
  });
}

async function findAvailableSeatLabels(page, count) {
  const available = await page.locator('.seat:not(.occupied)').evaluateAll(nodes =>
    nodes.map(node => node.dataset.label),
  );
  const preferred = available
    .filter(label => label.startsWith('E'))
    .sort((left, right) => Math.abs(Number(left.slice(1)) - 9) - Math.abs(Number(right.slice(1)) - 9));
  const labels = [...preferred, ...available.filter(label => !label.startsWith('E'))].slice(0, count);
  if (labels.length !== count) {
    throw new Error(`La séance n'a pas assez de places libres pour la démonstration (${count} demandées).`);
  }
  return labels;
}

async function chooseSeats(page, labels) {
  for (const label of labels) {
    const seat = page.locator(`.seat[data-label="${label}"]`);
    await seat.waitFor({ state: 'visible' });
    if (await seat.evaluate(node => node.classList.contains('occupied'))) {
      throw new Error(`Le siège ${label} est déjà réservé; adaptez les sièges de démonstration.`);
    }
    await seat.click();
  }
}

async function createPresentationImages(desktopPath, mobilePath) {
  const desktop = await sharp(desktopPath).png().toBuffer();
  const mobile = await sharp(mobilePath).png().toBuffer();

  const socialSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#17130b"/><stop offset="1" stop-color="#090909"/></linearGradient><radialGradient id="glow"><stop stop-color="#f5c518" stop-opacity=".2"/><stop offset="1" stop-color="#f5c518" stop-opacity="0"/></radialGradient></defs>
    <rect width="1280" height="640" fill="url(#bg)"/><circle cx="930" cy="310" r="420" fill="url(#glow)"/>
    <text x="76" y="150" fill="#f5c518" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="6">TESKERTI</text>
    <text x="76" y="235" fill="#fffbea" font-family="Arial,sans-serif" font-size="54" font-weight="700">Le cinéma tunisien,</text>
    <text x="76" y="300" fill="#fffbea" font-family="Arial,sans-serif" font-size="54" font-weight="700">à portée de clic.</text>
    <text x="78" y="355" fill="#bcb8ae" font-family="Arial,sans-serif" font-size="21">Découvrez. Choisissez. Vivez le grand écran.</text>
    <rect x="76" y="405" width="230" height="48" rx="24" fill="#f5c518"/><text x="191" y="436" text-anchor="middle" fill="#111" font-family="Arial,sans-serif" font-size="17" font-weight="700">RÉSERVATION EN LIGNE</text>
    <rect x="548" y="78" width="626" height="370" rx="24" fill="#f5c518" fill-opacity=".15"/>
    <rect x="548" y="78" width="626" height="370" rx="24" fill="none" stroke="#f5c518" stroke-opacity=".75" stroke-width="2"/>
    <rect x="1026" y="215" width="190" height="348" rx="34" fill="#24211a" stroke="#f5c518" stroke-width="3"/>
    <rect x="1040" y="236" width="162" height="305" rx="24" fill="#0a0a0a"/>
    <circle cx="1121" cy="224" r="4" fill="#999"/>
    <text x="1090" y="602" text-anchor="middle" fill="#bcb8ae" font-family="Arial,sans-serif" font-size="15">TESKERTI · PAIEMENT SIMULÉ</text>
  </svg>`);
  const socialBase = await sharp(socialSvg).png().toBuffer();
  const desktopCard = await sharp(desktop).resize(626, 370, { fit: 'cover', position: 'top' }).png().toBuffer();
  const mobileCard = await sharp(mobile).resize(162, 305, { fit: 'cover', position: 'top' }).png().toBuffer();
  const social = await sharp(socialBase).composite([
    { input: desktopCard, left: 548, top: 78 },
    { input: mobileCard, left: 1040, top: 236 },
  ]).png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(imagesDir, 'social-preview.png'), social);

  const linkedinSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#201909"/><stop offset=".55" stop-color="#111"/><stop offset="1" stop-color="#080808"/></linearGradient></defs>
    <rect width="1200" height="627" fill="url(#bg)"/>
    <path d="M0 470 Q420 300 1200 500 V627 H0Z" fill="#f5c518" fill-opacity=".08"/>
    <text x="74" y="122" fill="#f5c518" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="7">TESKERTI</text>
    <text x="74" y="205" fill="#fffbea" font-family="Arial,sans-serif" font-size="48" font-weight="700">Votre prochaine séance</text>
    <text x="74" y="265" fill="#fffbea" font-family="Arial,sans-serif" font-size="48" font-weight="700">commence ici.</text>
    <text x="76" y="317" fill="#c8c3b6" font-family="Arial,sans-serif" font-size="21">Films · Cinémas · Billets — une expérience tunisienne.</text>
    <rect x="70" y="363" width="732" height="196" rx="18" fill="#24211a" stroke="#f5c518" stroke-opacity=".7" stroke-width="2"/>
    <rect x="844" y="193" width="230" height="395" rx="38" fill="#24211a" stroke="#f5c518" stroke-width="3"/>
    <rect x="858" y="215" width="202" height="350" rx="26" fill="#0a0a0a"/>
    <text x="959" y="610" text-anchor="middle" fill="#bcb8ae" font-family="Arial,sans-serif" font-size="14">PAIEMENT SIMULÉ</text>
  </svg>`);
  const linkedinBase = await sharp(linkedinSvg).png().toBuffer();
  const linkedDesktop = await sharp(desktop).resize(732, 196, { fit: 'cover', position: 'top' }).png().toBuffer();
  const linkedMobile = await sharp(mobile).resize(202, 350, { fit: 'cover', position: 'top' }).png().toBuffer();
  const linkedin = await sharp(linkedinBase).composite([
    { input: linkedDesktop, left: 70, top: 363 },
    { input: linkedMobile, left: 858, top: 215 },
  ]).png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(imagesDir, 'linkedin-banner.png'), linkedin);

  const mockupSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#211a0d"/><stop offset="1" stop-color="#080808"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#bg)"/>
    <text x="100" y="105" fill="#f5c518" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="8">TESKERTI</text>
    <text x="100" y="165" fill="#fffbea" font-family="Arial,sans-serif" font-size="38" font-weight="700">Une expérience cinéma, sur tous vos écrans.</text>
    <rect x="78" y="225" width="1194" height="690" rx="28" fill="#27231a" stroke="#f5c518" stroke-width="4"/>
    <rect x="1300" y="355" width="222" height="510" rx="42" fill="#27231a" stroke="#f5c518" stroke-width="4"/>
    <rect x="1315" y="380" width="192" height="462" rx="27" fill="#080808"/>
    <circle cx="1411" cy="366" r="5" fill="#777"/>
  </svg>`);
  const mockupBase = await sharp(mockupSvg).png().toBuffer();
  const desktopFrame = await sharp(desktop).resize(1194, 690, { fit: 'cover', position: 'top' }).png().toBuffer();
  const mobileFrame = await sharp(mobile).resize(192, 462, { fit: 'cover', position: 'top' }).png().toBuffer();
  const mockup = await sharp(mockupBase).composite([
    { input: desktopFrame, left: 78, top: 225 },
    { input: mobileFrame, left: 1315, top: 380 },
  ]).png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(imagesDir, 'mockup-desktop-mobile.png'), mockup);

  const architectureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#17130b"/><stop offset="1" stop-color="#080808"/></linearGradient><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0 0 12 6 0 12Z" fill="#f5c518"/></marker></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="800" y="118" text-anchor="middle" fill="#f5c518" font-family="Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="5">ARCHITECTURE TESKERTI</text>
    <text x="800" y="165" text-anchor="middle" fill="#bcb8ae" font-family="Arial,sans-serif" font-size="18">Réservation de cinéma · environnement de démonstration</text>
    <rect x="100" y="315" width="330" height="250" rx="24" fill="#1c1c1c" stroke="#f5c518" stroke-width="3"/>
    <text x="265" y="390" text-anchor="middle" fill="#f5c518" font-family="Arial,sans-serif" font-size="20" font-weight="700">FRONTEND SPA</text>
    <text x="265" y="438" text-anchor="middle" fill="#fffbea" font-family="Arial,sans-serif" font-size="19">HTML · CSS · JavaScript</text>
    <text x="265" y="475" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="16">Routeur par hash</text>
    <text x="265" y="520" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="15">localhost:3000</text>
    <rect x="635" y="315" width="330" height="250" rx="24" fill="#1c1c1c" stroke="#f5c518" stroke-width="3"/>
    <text x="800" y="390" text-anchor="middle" fill="#f5c518" font-family="Arial,sans-serif" font-size="20" font-weight="700">API REST</text>
    <text x="800" y="438" text-anchor="middle" fill="#fffbea" font-family="Arial,sans-serif" font-size="19">PHP · API v1</text>
    <text x="800" y="475" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="16">Auth · séances · réservations</text>
    <text x="800" y="520" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="15">localhost:8000</text>
    <rect x="1170" y="315" width="330" height="250" rx="24" fill="#1c1c1c" stroke="#f5c518" stroke-width="3"/>
    <text x="1335" y="390" text-anchor="middle" fill="#f5c518" font-family="Arial,sans-serif" font-size="20" font-weight="700">MYSQL / MARIADB</text>
    <text x="1335" y="438" text-anchor="middle" fill="#fffbea" font-family="Arial,sans-serif" font-size="19">Données relationnelles</text>
    <text x="1335" y="475" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="16">Films · sièges · billets</text>
    <path d="M450 440H610" fill="none" stroke="#f5c518" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="530" y="410" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="15">JSON / HTTP</text>
    <path d="M985 440H1145" fill="none" stroke="#f5c518" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="1065" y="410" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="15">PDO / SQL</text>
    <rect x="520" y="675" width="560" height="118" rx="20" fill="#281e08" stroke="#f5c518" stroke-width="2"/>
    <text x="800" y="722" text-anchor="middle" fill="#f5c518" font-family="Arial,sans-serif" font-size="20" font-weight="700">PAIEMENT VISA SIMULÉ</text>
    <text x="800" y="760" text-anchor="middle" fill="#fffbea" font-family="Arial,sans-serif" font-size="16">Aucun prestataire bancaire · carte de test uniquement</text>
    <path d="M800 575V652" fill="none" stroke="#f5c518" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="800" y="625" text-anchor="middle" fill="#aaa" font-family="Arial,sans-serif" font-size="14">Flux de paiement de démonstration</text>
  </svg>`;
  const architecture = await sharp(Buffer.from(architectureSvg)).png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(imagesDir, 'architecture.png'), architecture);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
await context.route(/^https?:\/\/(images\.unsplash\.com|via\.placeholder\.com)\//, async route => {
  await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: genericImageSvg(route.request().url()) });
});
await context.addInitScript(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input.url;
    if (requestUrl.includes('/api/v1/bookings') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      body.promo_code = 'TESKERTI10';
      init = { ...init, body: JSON.stringify(body) };
    }
    return originalFetch(input, init);
  };
});

try {
  const page = await context.newPage();
  page.on('pageerror', error => console.error(`Browser error: ${error.message}`));
  await page.goto(`${baseUrl}/#home`, { waitUntil: 'domcontentloaded' });
  await page.locator('.movies-grid .movie-card').first().waitFor({ state: 'visible', timeout: 20000 });
  await waitForPage(page);
  await showMoviePosters(page);
  await screenshot(page, '01-accueil.png');

  await page.locator('button[data-modal="login"]').click();
  await page.locator('#auth-modal.open').waitFor();
  await page.waitForTimeout(350);
  await screenshot(page, '04-connexion.png');

  await page.locator('[data-tab="register"]').click();
  await page.locator('#reg-fname').fill(demoUser.firstName);
  await page.locator('#reg-lname').fill(demoUser.lastName);
  await page.locator('#reg-email').fill(demoUser.email);
  await page.locator('#reg-phone').fill('+216 20 555 010');
  await page.locator('#reg-password').fill(fakePassword);
  await page.waitForTimeout(350);
  await screenshot(page, '05-inscription.png');
  await page.locator('#form-register button[type="submit"]').click();
  await page.locator('#auth-modal.open').waitFor({ state: 'hidden', timeout: 20000 });
  await page.locator('#nav-auth-user:not(.hidden)').waitFor();

  await waitForHashPage(page, 'cinemas', '.cinemas-list .cinema-card');
  await screenshot(page, '03-cinemas.png', { fullPage: true });

  await waitForHashPage(page, 'booking/1', '.booking-layout');
  await page.locator('.seat-row').first().waitFor({ state: 'visible' });
  await screenshot(page, '02-detail-film-seances.png');
  const desktopSeats = await findAvailableSeatLabels(page, 2);
  await chooseSeats(page, desktopSeats);
  await page.locator('#plus-normal').click();
  await page.locator('#plus-normal').click();
  await page.waitForFunction(() => !document.querySelector('#checkout-btn')?.disabled);
  await centerSelectedSeats(page);
  await page.mouse.move(viewport.width - 5, viewport.height - 5);
  await screenshot(page, '06-plan-de-salle.png');
  await page.locator('#checkout-btn').click();
  await page.locator('#payment-page').waitFor({ state: 'visible' });
  await page.locator('#summary-movie-title').waitFor();
  await applyPromoPresentation(page);
  await page.waitForTimeout(350);
  await screenshot(page, '07-recapitulatif.png');

  await fillPayment(page);
  await page.waitForFunction(() => !document.querySelector('#btn-pay')?.disabled);
  await screenshot(page, '08-paiement.png');
  await page.locator('#btn-pay').click();
  await page.locator('#confirmation-page').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#ticket-ref').waitFor();
  await makeQrVisible(page);
  await normalizeTicketTime(page);
  await page.waitForTimeout(400);
  await screenshot(page, '09-confirmation.png');

  const mobileContext = await browser.newContext({
    viewport: mobileViewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const authStorage = await page.evaluate(() => ({
    token: localStorage.getItem('teskerti_token'),
    user: localStorage.getItem('teskerti_user'),
  }));
  await mobileContext.addInitScript(({ token, user }) => {
    if (token) localStorage.setItem('teskerti_token', token);
    if (user) localStorage.setItem('teskerti_user', user);
  }, authStorage);
  await mobileContext.route(/^https?:\/\/(images\.unsplash\.com|via\.placeholder\.com)\//, async route => {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: genericImageSvg(route.request().url()) });
  });
  await mobileContext.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const requestUrl = typeof input === 'string' ? input : input.url;
      if (requestUrl.includes('/api/v1/bookings') && init.method === 'POST') {
        const body = JSON.parse(init.body);
        body.promo_code = 'TESKERTI10';
        init = { ...init, body: JSON.stringify(body) };
      }
      return originalFetch(input, init);
    };
  });

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${baseUrl}/#home`, { waitUntil: 'domcontentloaded' });
  await mobilePage.locator('.movies-grid .movie-card').first().waitFor({ state: 'visible', timeout: 20000 });
  await waitForPage(mobilePage);
  await showMoviePosters(mobilePage);
  await screenshot(mobilePage, '10-mobile-accueil.png');

  await waitForHashPage(mobilePage, 'booking/1', '.booking-layout');
  await mobilePage.locator('.seat-row').first().waitFor({ state: 'visible' });
  await mobilePage.addStyleTag({
    content: `@media (max-width: 600px) {
      .booking-layout { width: 100% !important; min-width: 0 !important; padding: 0 12px !important; }
      .booking-steps, .step-card { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
      .step-card { padding: 16px !important; overflow: hidden !important; }
      .step-title { font-size: 1.15rem !important; flex-wrap: wrap !important; gap: 8px !important; }
      .screen { width: 100% !important; }
      .seats-container { zoom: .36 !important; overflow: visible !important; }
      .seat-legend { flex-wrap: wrap !important; gap: 12px !important; }
    }`,
  });
  const mobileSeats = await findAvailableSeatLabels(mobilePage, 1);
  await chooseSeats(mobilePage, mobileSeats);
  await mobilePage.locator('#plus-normal').click();
  await mobilePage.waitForFunction(() => !document.querySelector('#checkout-btn')?.disabled);
  await centerSelectedSeats(mobilePage);
  await screenshot(mobilePage, '11-mobile-plan-de-salle.png');

  await mobilePage.locator('#checkout-btn').click();
  await mobilePage.locator('#payment-page').waitFor({ state: 'visible' });
  await fillPayment(mobilePage);
  await mobilePage.locator('#btn-pay').click();
  await mobilePage.locator('#confirmation-page').waitFor({ state: 'visible', timeout: 30000 });
  await mobilePage.locator('#ticket-ref').waitFor();
  await makeQrVisible(mobilePage);
  await normalizeTicketTime(mobilePage);
  await mobilePage.locator('#ticket-card').scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(350);
  await screenshot(mobilePage, '12-mobile-billet.png');
  await mobileContext.close();

  await createPresentationImages(
    path.join(screenshotsDir, '01-accueil.png'),
    path.join(screenshotsDir, '12-mobile-billet.png'),
  );
} finally {
  await browser.close();
}
