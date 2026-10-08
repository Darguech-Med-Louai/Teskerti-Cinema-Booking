import { CONFIG } from './config.js';
import { DATA } from './data.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';
import { Payment } from './payment.js';

export async function renderBooking(container, movieId) {
    container.innerHTML = `
        <div style="padding: 100px; text-align: center;">
            <div class="spinner" style="width:40px; height:40px; border-width:4px;"></div>
            <p style="color:var(--gold); margin-top:20px;">Chargement de la seance...</p>
        </div>
    `;

    let movie = null, session = null, seatsData = [];

    try {
        movie = DATA.movies.find(m => m.id === parseInt(movieId)) || DATA.movies[0];

        // 1. Fetch Sessions
        const sessRes = await fetch(`${CONFIG.API_BASE_URL}/movies/${movieId}/sessions`).then(r => r.json());
        if (!sessRes.success || sessRes.data.length === 0) {
            container.innerHTML = `
                <div class="container" style="padding-top: 100px; text-align: center;">
                    <h2 class="hero-title" style="color:var(--gold);">Aucune seance disponible</h2>
                    <p style="margin-top: 20px;">Desole, il n'y a pas de seances programmees pour ce film en ce moment.</p>
                    <button class="btn btn-primary mt-4" data-view="home" style="margin-top: 30px;">Retour a l'accueil</button>
                </div>
            `;
            return;
        }
        
        // Take the first available session
        session = sessRes.data[0];

        // 2. Fetch Seats for this session
        const seatsRes = await fetch(`${CONFIG.API_BASE_URL}/sessions/${session.id}/seats`).then(r => r.json());
        if (seatsRes.success) {
            seatsData = seatsRes.data.seats;
        }
    } catch(e) {
        UI.showToast("Erreur lors du chargement de la seance", "error");
        container.innerHTML = `<div class="container" style="padding-top: 100px; text-align: center;"><h2 class="hero-title" style="color:var(--gold);">Erreur de chargement</h2></div>`;
        return;
    }

    const prices = DATA.pricing;
    const state = {
        selectedSeats: [],
        tickets: { normal: 0, senior: 0, student: 0, child: 0 },
        sessionId: session.id,
        sessionData: session
    };

    // Group seats by row
    const rows = {};
    seatsData.forEach(seat => {
        if (!rows[seat.row_label]) rows[seat.row_label] = [];
        rows[seat.row_label].push(seat);
    });

    let seatsHTML = '';
    for (const [rowLabel, rowSeats] of Object.entries(rows)) {
        seatsHTML += `<div class="seat-row"><div class="row-label" style="display:inline-block; width: 20px; color: var(--gray1);">${rowLabel}</div>`;
        rowSeats.forEach(seat => {
            const isOccupied = seat.is_taken;
            const seatClass = isOccupied ? 'seat occupied' : 'seat';
            seatsHTML += `<div class="${seatClass}" data-id="${seat.id}" data-label="${rowLabel}${seat.seat_num}" title="Siege ${rowLabel}${seat.seat_num} (${seat.zone})"></div>`;
        });
        seatsHTML += '</div>';
    }

    const formatDate = (ds) => {
        const d = new Date(ds);
        return d.toLocaleDateString('fr-FR') + ' a ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
    };

    const html = `
        <div class="container booking-layout">
            <aside class="booking-sidebar">
                <img src="${movie.poster}" alt="${movie.title}">
                <h3>${movie.title}</h3>
                <div class="booking-detail-item">
                    <div class="booking-detail-label">Cinema</div>
                    <div class="booking-detail-value">${session.cinema_name}</div>
                </div>
                <div class="booking-detail-item">
                    <div class="booking-detail-label">Date et Heure</div>
                    <div class="booking-detail-value">${formatDate(session.starts_at)}</div>
                </div>
                <div class="booking-detail-item">
                    <div class="booking-detail-label">Salle</div>
                    <div class="booking-detail-value">${session.hall_name}</div>
                </div>
                <div class="booking-detail-item">
                    <div class="booking-detail-label">Places Selectionnees</div>
                    <div class="booking-detail-value text-gold"><span id="selected-seats-count">0</span> place(s)</div>
                </div>
            </aside>

            <div class="booking-steps">
                <div class="step-card">
                    <h2 class="step-title"><span class="text-gold">01.</span> Choisissez vos places</h2>
                    <div class="screen">ECRAN</div>
                    <div class="seats-container" style="text-align: center;">
                        ${seatsHTML}
                    </div>
                    <div class="seat-legend">
                        <div class="legend-item"><div class="legend-color" style="background:var(--black4); border:1px solid var(--border2);"></div> Libre</div>
                        <div class="legend-item"><div class="legend-color" style="background:var(--gold);"></div> Selectionne</div>
                        <div class="legend-item"><div class="legend-color" style="background:var(--border);"></div> Occupe</div>
                    </div>
                </div>

                <div class="step-card">
                    <h2 class="step-title"><span class="text-gold">02.</span> Choisissez vos tarifs</h2>
                    <p style="color: var(--gray1); margin-bottom: 20px;">Indiquez le type de billet pour chaque place selectionnee.</p>
                    <div class="pricing-list">
                        ${Object.keys(prices).map(key => `
                            <div class="price-row">
                                <div class="price-info">
                                    <h4>${prices[key].label}</h4>
                                    <p>${prices[key].price.toFixed(3)} TND</p>
                                </div>
                                <div class="price-controls">
                                    <button class="price-btn" id="minus-${key}" data-type="${key}" data-action="minus" disabled>-</button>
                                    <span class="price-count" id="count-${key}">0</span>
                                    <button class="price-btn" id="plus-${key}" data-type="${key}" data-action="plus" disabled>+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="checkout-panel">
            <div class="container checkout-container">
                <div class="total-info">
                    <h3>Total de la commande</h3>
                    <div class="total-amount" id="total-amount">0.000 TND</div>
                </div>
                <button class="btn btn-primary" style="padding: 15px 40px; font-size: 1.3rem;" id="checkout-btn" disabled>Selectionnez des places</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    const updateTotals = () => {
        const totalSeats = state.selectedSeats.length;
        const totalTickets = Object.values(state.tickets).reduce((a, b) => a + b, 0);
        let totalAmount = 0;
        
        for (const [key, qty] of Object.entries(state.tickets)) {
            totalAmount += qty * prices[key].price;
        }

        const countEl = document.getElementById('selected-seats-count');
        const amountEl = document.getElementById('total-amount');
        if (countEl) countEl.textContent = totalSeats;
        if (amountEl) amountEl.textContent = totalAmount.toFixed(3) + ' TND';

        for (const key of Object.keys(state.tickets)) {
            const countLabel = document.getElementById(`count-${key}`);
            if (countLabel) countLabel.textContent = state.tickets[key];
            
            const plusBtn = document.getElementById(`plus-${key}`);
            const minusBtn = document.getElementById(`minus-${key}`);
            if (plusBtn) plusBtn.disabled = (totalTickets >= totalSeats);
            if (minusBtn) minusBtn.disabled = (state.tickets[key] <= 0);
        }

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            if (totalSeats === 0) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = "Selectionnez des places";
            } else if (totalTickets < totalSeats) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = `Choisissez ${totalSeats - totalTickets} billet(s)`;
            } else {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = "Payer " + totalAmount.toFixed(3) + " TND";
            }
        }
    };

    const seats = container.querySelectorAll('.seat:not(.occupied)');
    seats.forEach(seat => {
        seat.addEventListener('click', (e) => {
            const el = e.target;
            const seatId = el.dataset.id;
            const seatLabel = el.dataset.label;

            if (el.classList.contains('selected')) {
                el.classList.remove('selected');
                state.selectedSeats = state.selectedSeats.filter(s => s.id !== seatId);
                let totalTickets = Object.values(state.tickets).reduce((a,b)=>a+b,0);
                if (totalTickets > state.selectedSeats.length) {
                    for(const key of Object.keys(state.tickets)) {
                        if (state.tickets[key] > 0) {
                            state.tickets[key]--;
                            break;
                        }
                    }
                }
            } else {
                el.classList.add('selected');
                state.selectedSeats.push({ id: seatId, label: seatLabel });
            }
            updateTotals();
        });
    });

    const priceBtns = container.querySelectorAll('.price-btn');
    priceBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            const action = e.currentTarget.dataset.action;
            
            if (action === 'plus') {
                const totalSeats = state.selectedSeats.length;
                const totalTickets = Object.values(state.tickets).reduce((a, b) => a + b, 0);
                if (totalTickets < totalSeats) {
                    state.tickets[type]++;
                }
            } else {
                if (state.tickets[type] > 0) {
                    state.tickets[type]--;
                }
            }
            updateTotals();
        });
    });

    container.querySelector('#checkout-btn').addEventListener('click', () => {
        if (!Auth.isLoggedIn()) {
            Auth.openModal('login');
            UI.showToast('Connectez-vous pour finaliser votre reservation', 'info');
            return;
        }

        const buildTicketsSummary = () => {
            return Object.entries(state.tickets || {})
              .filter(([, count]) => count > 0)
              .map(([type, count]) => ({
                type  : type,
                label : prices[type].label,
                price : prices[type].price,
                count,
              }));
        };

        const bookingState = {
            movie: movie,
            cinema: { name: session.cinema_name },
            session: { id: session.id, date: formatDate(session.starts_at) },
            selected: state.selectedSeats.map(s => ({ id: s.id, label: s.label, zone: 'Standard' })),
            tickets: buildTicketsSummary(),
            promoCode: null,
            promoDiscount: 0,
        };

        // Transition to payment
        document.getElementById('app').style.display = 'none';
        document.getElementById('payment-page').style.display = 'block';
        Payment.init(bookingState);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    updateTotals();
}
