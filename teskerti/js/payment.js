import { CONFIG } from './config.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

const SERVICE_FEE = 1.000;
const CURRENCY = 'TND';

export const Payment = {
  state: {
    cardNumber: '',
    cardHolder: '',
    expiry: '',
    cvv: '',
    isFlipped: false,
    isValid: false,
    bookingState: null
  },

  init(bookingState) {
    this.state.bookingState = bookingState;
    this.bindInputs();
    this.populateSummary();
    this.updatePayButton();
    this.bindActions();
  },

  bindInputs() {
    const cardNumInput = document.getElementById('card-number');
    const cardHolderInput = document.getElementById('card-holder');
    const expiryInput = document.getElementById('card-expiry');
    const cvvInput = document.getElementById('card-cvv');

    if (!cardNumInput) return;

    cardNumInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      if (v.length > 0 && !v.startsWith('4')) {
        this.setError('card-number', 'Seules les cartes Visa (commencant par 4) sont acceptees.');
        e.target.value = '';
        this.state.cardNumber = '';
        this.hideCardIcon();
        return;
      }
      this.clearError('card-number');
      v = v.match(/.{1,4}/g)?.join(' ') || v;
      e.target.value = v;
      this.state.cardNumber = v;
      
      const display = document.getElementById('card-number-display');
      if (display) {
        display.textContent = v.padEnd(19, '*').replace(/(\S{4})/g, '$1 ').trim() || '**** **** **** ****';
      }
      if (v.replace(/\s/g, '').length >= 1) this.showCardIcon();
      this.updatePayButton();
    });

    cardHolderInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
      this.state.cardHolder = e.target.value;
      const display = document.getElementById('card-holder-display');
      if (display) display.textContent = e.target.value || 'PRENOM NOM';
      this.clearError('card-holder');
      this.updatePayButton();
    });

    expiryInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
      e.target.value = v;
      this.state.expiry = v;
      const display = document.getElementById('card-expiry-display');
      if (display) display.textContent = v || 'MM/AA';
      
      if (v.length === 5) {
        const [mm, yy] = v.split('/').map(Number);
        const now = new Date();
        const cardDate = new Date(2000 + yy, mm - 1);
        if (mm < 1 || mm > 12 || cardDate < now) {
          this.setError('card-expiry', 'Date expiree ou invalide');
        } else {
          this.clearError('card-expiry');
        }
      }
      this.updatePayButton();
    });

    cvvInput.addEventListener('focus', () => this.flipCard(true));
    cvvInput.addEventListener('blur', () => this.flipCard(false));
    cvvInput.addEventListener('input', (e) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 3);
      e.target.value = v;
      this.state.cvv = v;
      const display = document.getElementById('card-cvv-display');
      if (display) display.textContent = '*'.repeat(v.length) || '***';
      this.updatePayButton();
    });
  },

  bindActions() {
    const payBtn = document.getElementById('btn-pay');
    if (payBtn) {
        payBtn.onclick = () => this.submit();
    }

    const backBtn = document.getElementById('btn-back-to-booking');
    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('payment-page').style.display = 'none';
            document.getElementById('app').style.display = 'block';
        };
    }

    const downloadBtn = document.getElementById('btn-download-ticket');
    if (downloadBtn) {
        downloadBtn.onclick = () => window.print();
    }

    const homeBtn = document.getElementById('btn-confirm-home');
    if (homeBtn) {
        homeBtn.onclick = () => {
             document.getElementById('confirmation-page').style.display = 'none';
             window.router.navigate('home');
        };
    }
  },

  flipCard(flip) {
    const card = document.getElementById('card-visual');
    if (card) card.classList.toggle('flipped', flip);
  },

  showCardIcon() {
    document.getElementById('input-card-icon')?.classList.add('visible');
  },
  hideCardIcon() {
    document.getElementById('input-card-icon')?.classList.remove('visible');
  },

  luhnCheck(num) {
    const digits = num.replace(/\s/g, '').split('').map(Number).reverse();
    const sum = digits.reduce((acc, d, i) => {
      if (i % 2 !== 0) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return acc + d;
    }, 0);
    return sum % 10 === 0;
  },

  validate() {
    let isValid = true;
    const num = this.state.cardNumber.replace(/\s/g, '');
    const holder = this.state.cardHolder.trim();
    const expiry = this.state.expiry;
    const cvv = this.state.cvv;

    if (!num.startsWith('4') || num.length !== 16 || !this.luhnCheck(num)) {
      this.setError('card-number', 'Numero Visa invalide');
      isValid = false;
    } else {
      this.clearError('card-number');
    }

    if (holder.length < 3 || !/^[A-Z\s-]+$/.test(holder)) {
      this.setError('card-holder', 'Nom invalide');
      isValid = false;
    } else {
      this.clearError('card-holder');
    }

    if (expiry.length !== 5 || !this.expiryValid(expiry)) {
      this.setError('card-expiry', 'Date invalide');
      isValid = false;
    } else {
      this.clearError('card-expiry');
    }

    if (cvv.length !== 3) {
      this.setError('card-cvv', 'CVV requis');
      isValid = false;
    } else {
      this.clearError('card-cvv');
    }

    return isValid;
  },

  expiryValid(v) {
    const [mm, yy] = v.split('/').map(Number);
    const now = new Date();
    const cardDate = new Date(2000 + yy, mm - 1);
    return mm >= 1 && mm <= 12 && cardDate >= now;
  },

  updatePayButton() {
    const btn = document.getElementById('btn-pay');
    if (!btn) return;
    const allFilled =
      this.state.cardNumber.replace(/\s/g, '').length === 16 &&
      this.state.cardHolder.length >= 3 &&
      this.state.expiry.length === 5 &&
      this.state.cvv.length === 3;
    btn.disabled = !allFilled;
    btn.classList.toggle('ready', allFilled);
  },

  populateSummary() {
    const bs = this.state.bookingState;
    if (!bs) return;

    const tickets = bs.tickets || [];
    const subtotal = tickets.reduce((s, t) => s + (t.price * t.count), 0);
    const total = subtotal + SERVICE_FEE - (bs.promoDiscount || 0);

    document.getElementById('summary-movie-title').textContent = bs.movie?.title || '--';
    document.getElementById('summary-cinema').textContent = bs.cinema?.name || '--';
    document.getElementById('summary-date').textContent = bs.session?.date || '--';

    if (bs.movie?.poster) {
      document.getElementById('summary-poster').src = bs.movie.poster;
    }

    const wrap = document.getElementById('summary-tickets');
    if (wrap) {
        wrap.innerHTML = tickets.map(t => `
          <div class="summary-ticket-line">
            <span>${t.count}x ${t.label}</span>
            <span>${(t.price * t.count).toFixed(3)} ${CURRENCY}</span>
          </div>
        `).join('');
    }

    document.getElementById('summary-service-fee').textContent = SERVICE_FEE.toFixed(3) + ' ' + CURRENCY;
    document.getElementById('summary-total').textContent = total.toFixed(3) + ' ' + CURRENCY;
    document.getElementById('btn-pay-amount').textContent = total.toFixed(3) + ' ' + CURRENCY;

    const promoEl = document.getElementById('summary-promo-applied');
    if (bs.promoDiscount > 0 && promoEl) {
      promoEl.style.display = 'flex';
      document.getElementById('summary-promo-text').textContent = 'Code promo : ' + (bs.promoCode || '');
      document.getElementById('summary-promo-discount').textContent = '-' + bs.promoDiscount.toFixed(3) + ' ' + CURRENCY;
    } else if (promoEl) {
      promoEl.style.display = 'none';
    }
  },

  async submit() {
    if (!this.validate()) {
        UI.showToast("Informations de carte invalides", "error");
        return;
    }

    const btn = document.getElementById('btn-pay');
    UI.showLoading(btn);

    try {
      const token = Auth.token;
      const bs = this.state.bookingState;
      
      // 1. Build Payload
      const seat_ids = bs.selected.map(s => parseInt(s.id));
      const tickets = [];
      let seatIdx = 0;
      bs.tickets.forEach(tc => {
          for(let i=0; i<tc.count; i++) {
              if (seatIdx < seat_ids.length) {
                  let dtype = tc.type;
                  if (dtype === "student") dtype = "etudiant";
                  if (dtype === "child") dtype = "enfant";
                  tickets.push({ seat_id: seat_ids[seatIdx], type: dtype });
                  seatIdx++;
              }
          }
      });

      const bookingPayload = {
         session_id: parseInt(bs.session.id),
         seat_ids: seat_ids,
         tickets: tickets,
         promo_code: bs.promoCode || ""
      };

      // 2. Create Booking
      const bookingRes = await fetch(`${CONFIG.API_BASE_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(bookingPayload)
      });
      const bookingData = await bookingRes.json();
      if (!bookingData.success) throw new Error(bookingData.error || 'Erreur lors de la reservation');

      // 3. Process Payment
      const payRes = await fetch(`${CONFIG.API_BASE_URL}/payments/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
              card_number: this.state.cardNumber.replace(/\s/g, ''),
              card_holder: this.state.cardHolder,
              card_expiry: this.state.expiry,
              card_cvv: this.state.cvv,
              booking_ref: bookingData.data.booking_ref,
              amount: bookingData.data.total
          })
      });
      const payData = await payRes.json();
      if (!payData.success) throw new Error(payData.error || 'Paiement refuse');

      this.state.paymentResult = payData.data;
      this.showConfirmation(bs);

    } catch (err) {
      UI.showToast(err.message, "error");
      this.shakeForm();
    } finally {
      UI.hideLoading(btn);
    }
  },

  shakeForm() {
    const form = document.getElementById('payment-form');
    if (form) {
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 600);
    }
  },

  showConfirmation(bs) {
    document.getElementById('payment-page').style.display = 'none';
    document.getElementById('confirmation-page').style.display = 'block';

    const res = this.state.paymentResult;
    document.getElementById('confirm-email').textContent = Auth.user?.email || 'votre email';
    document.getElementById('ticket-movie-name').textContent = bs.movie?.title || '--';
    document.getElementById('ticket-cinema').textContent = bs.cinema?.name || '--';
    document.getElementById('ticket-date').textContent = bs.session?.date || '--';
    document.getElementById('ticket-seats').textContent = bs.selected.map(s => s.label).join(', ') || '--';
    document.getElementById('ticket-amount').textContent = (res?.amount || 0).toFixed(3) + ' ' + CURRENCY;
    document.getElementById('ticket-ref').textContent = res?.booking_ref || '---';

    if (res?.qr_code_url) {
        document.getElementById('ticket-qr').innerHTML = `<img src="${res.qr_code_url}" width="120" height="120" style="background:#fff;border-radius:4px;padding:4px" />`;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      document.querySelector('.checkmark-svg')?.classList.add('animate');
    }, 300);
  },

  setError(fieldId, msg) {
    const err = document.getElementById('err-' + fieldId);
    const input = document.getElementById(fieldId);
    if (err) err.textContent = msg;
    if (input) input.classList.add('error');
  },
  clearError(fieldId) {
    const err = document.getElementById('err-' + fieldId);
    const input = document.getElementById(fieldId);
    if (err) err.textContent = '';
    if (input) input.classList.remove('error');
  }
};
