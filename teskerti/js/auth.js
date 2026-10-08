import { CONFIG } from './config.js';
import { UI } from './ui.js';

/* -- Gestion token JWT localStorage -- */
export const Auth = {
  token: null,
  user: null,

  init() {
    const saved = localStorage.getItem('teskerti_token');
    if (saved) {
      this.token = saved;
      this.user = JSON.parse(localStorage.getItem('teskerti_user'));
      this.updateNavbar();
    }
    this.bindScrollNavbar();
    this.bindModalClose();
  },

  /* LOGIN */
  async login(email, password, submitBtn = null) {
    UI.showLoading(submitBtn);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Erreur de connexion');

      this.token = result.data.token;
      this.user = result.data.user;
      localStorage.setItem('teskerti_token', this.token);
      localStorage.setItem('teskerti_user', JSON.stringify(this.user));
      
      this.updateNavbar();
      this.closeModal();
      UI.showToast(`Bienvenue ${this.user.name} !`, 'success');
    } catch(e) {
      UI.showToast(e.message, 'error');
    } finally { 
      UI.hideLoading(submitBtn); 
    }
  },

  /* REGISTER */
  async register(fname, lname, email, password, submitBtn = null) {
    UI.showLoading(submitBtn);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: fname, last_name: lname, email, password })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Erreur lors de la creation');

      this.token = result.data.token;
      this.user = result.data.user;
      localStorage.setItem('teskerti_token', this.token);
      localStorage.setItem('teskerti_user', JSON.stringify(this.user));

      this.updateNavbar();
      this.closeModal();
      UI.showToast('Compte cree avec succes !', 'success');
    } catch(e) {
      UI.showToast(e.message, 'error');
    } finally { 
      UI.hideLoading(submitBtn); 
    }
  },

  /* LOGOUT */
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('teskerti_token');
    localStorage.removeItem('teskerti_user');
    this.updateNavbar();
    UI.showToast('Deconnecte avec succes', 'info');
    
    if (window.location.hash.includes('booking')) {
        window.router.navigate('home', null, true);
    }
  },

  isLoggedIn() { return !!this.token; },

  updateNavbar() {
    const guest = document.getElementById('nav-auth-guest');
    const user = document.getElementById('nav-auth-user');
    if (this.isLoggedIn() && this.user) {
      guest.classList.add('hidden');
      user.classList.remove('hidden');
      document.getElementById('user-initials').textContent = this.user.initials;
      document.getElementById('dropdown-name').textContent = this.user.name;
      document.getElementById('dropdown-email').textContent = this.user.email;
    } else {
      guest.classList.remove('hidden');
      user.classList.add('hidden');
    }
  },

  bindScrollNavbar() {
    const nav = document.getElementById('navbar');
    if(!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  },

  bindModalClose() {
    document.getElementById('auth-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'auth-modal') this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  openModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if(!modal) return;
    modal.classList.add('open');
    this.switchTab(tab);
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    const modal = document.getElementById('auth-modal');
    if(!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  },

  switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f =>
      f.classList.toggle('active', f.id === 'form-' + tab));
  }
};
