/**
 * TESKERTI -- UI Utils & Notifications
 */

export const UI = {
    /**
     * Show a premium toast notification
     * @param {string} message 
     * @param {'success'|'error'|'info'|'warning'} type 
     */
    showToast(message, type = 'success') {
        const container = this.getToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = this.getIconForType(type);
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <div class="toast-close">X</div>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('show'));
        
        // Auto-remove
        const timer = setTimeout(() => this.removeToast(toast), 4000);
        
        // Close on click
        toast.querySelector('.toast-close').onclick = () => {
            clearTimeout(timer);
            this.removeToast(toast);
        };
    },

    removeToast(toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    },

    getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    },

    getIconForType(type) {
        switch(type) {
            case 'success': return '[OK]';
            case 'error':   return 'X';
            case 'warning': return '[!]';
            default:        return '[i]';
        }
    },

    showLoading(btn) {
        if (!btn) return;
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Chargement...';
    },

    hideLoading(btn) {
        if (!btn || !btn.dataset.originalText) return;
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText;
    }
};
