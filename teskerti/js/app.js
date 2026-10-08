import { DATA, initData } from './data.js';
import { Auth } from './auth.js';
import { renderHome } from './movies.js';
import { renderCinemas } from './cinemas.js';
import { renderBooking } from './booking.js';
import { UI } from './ui.js';

class Router {
    constructor() {
        this.appContainer = document.getElementById('app');
        this.init();
    }

    init() {
        // Global Click Listener (Event Delegation)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-view]');
            if (link) {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                const id = link.getAttribute('data-id');
                this.navigate(view, id);
            }

            // Handle Modal Toggles
            const modalBtn = e.target.closest('[data-modal]');
            if (modalBtn) {
                const action = modalBtn.getAttribute('data-modal');
                if (action === 'login') Auth.openModal('login');
                if (action === 'register') Auth.openModal('register');
                if (action === 'close') Auth.closeModal();
            }

            // Handle Tab Switching in Auth Modal
            const tabBtn = e.target.closest('[data-tab]');
            if (tabBtn) {
                Auth.switchTab(tabBtn.getAttribute('data-tab'));
            }

            // Handle Logout
            const logoutBtn = e.target.closest('#logout-btn');
            if (logoutBtn) {
                e.preventDefault();
                Auth.logout();
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                this.render(e.state.view, e.state.id, false);
            } else {
                this.render('home', null, false);
            }
        });

        // Initial Navigation
        const hash = window.location.hash.substring(1).split('/');
        const view = hash[0] || 'home';
        const id = hash[1] || null;
        this.navigate(view, id, true);
    }

    navigate(view, id = null, replace = false) {
        const path = `#${view}${id ? '/' + id : ''}`;
        if (replace) {
            window.history.replaceState({ view, id }, '', path);
        } else {
            window.history.pushState({ view, id }, '', path);
        }
        this.render(view, id);
    }

    render(view, id, scroll = true) {
        // Reset view containers
        const pp = document.getElementById('payment-page');
        if(pp) pp.style.display = 'none';
        const cp = document.getElementById('confirmation-page');
        if(cp) cp.style.display = 'none';
        
        this.appContainer.style.display = 'block';
        this.appContainer.style.opacity = 0;

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-view="${view}"]`);
        if (activeLink) activeLink.classList.add('active');

        setTimeout(async () => {
            this.appContainer.innerHTML = '';
            
            try {
                if (view === 'home') {
                    renderHome(this.appContainer);
                } else if (view === 'cinemas') {
                    renderCinemas(this.appContainer);
                } else if (view === 'booking') {
                    if (!Auth.isLoggedIn()) {
                        Auth.openModal('login');
                        UI.showToast("Merci de vous connecter pour reserver", "info");
                        this.navigate('home', null, true);
                        return;
                    }
                    await renderBooking(this.appContainer, id);
                } else {
                    this.appContainer.innerHTML = '<div class="container" style="padding-top: 100px; text-align: center;"><h2 class="hero-title" style="color:var(--gold);">Page introuvable</h2></div>';
                }
            } catch (err) {
                console.error("Render Error:", err);
                UI.showToast("Erreur d'affichage de la page", "error");
            }
            
            this.appContainer.style.transition = 'opacity 0.3s ease';
            this.appContainer.style.opacity = 1;
            
            if (scroll) window.scrollTo(0, 0);
        }, 150);
    }
}

// Global Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data
    await initData();
    
    // 2. Init Auth
    Auth.init();
    
    // 3. Init Router
    window.router = new Router();

    // 4. Bind specific forms (that are in index.html)
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            Auth.login(email, pass, loginForm.querySelector('button[type="submit"]'));
        };
    }

    const regForm = document.getElementById('form-register');
    if (regForm) {
        regForm.onsubmit = (e) => {
            e.preventDefault();
            const fname = document.getElementById('reg-fname').value;
            const lname = document.getElementById('reg-lname').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;
            Auth.register(fname, lname, email, pass, regForm.querySelector('button[type="submit"]'));
        };
    }
});
