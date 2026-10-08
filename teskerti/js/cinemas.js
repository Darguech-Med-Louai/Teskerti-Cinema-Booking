import { DATA } from './data.js';

export function renderCinemas(container) {
    const cinemas = DATA.cinemas;

    const html = `
        <div class="container" style="padding-top: 60px; min-height: 70vh;">
            <h1 class="hero-title" style="font-size: 60px; margin-bottom: 20px;">NOS CINEMAS</h1>
            <p style="color: var(--gray1); margin-bottom: 60px; font-size: 1.1rem; max-width: 600px; line-height: 1.6;">
                Decouvrez notre reseau de salles partenaires a travers toute la Tunisie, equipees des dernieres technologies de projection pour une immersion totale.
            </p>

            <div class="cinemas-list">
                ${cinemas.map(cinema => `
                    <div class="cinema-card">
                        <div class="cinema-img-wrap">
                            <img
                              src="${cinema.image}"
                              alt="${cinema.name}"
                              class="cinema-img"
                              loading="lazy"
                              onerror="this.src='https://via.placeholder.com/800x600?text=Cinema+Image'"
                            />
                            <div class="cinema-img-overlay"></div>
                        </div>
                        <div class="cinema-card-body">
                            <h3>${cinema.name}</h3>
                            <p>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                ${cinema.address}
                            </p>
                            <p style="color: var(--gray1); font-size: 0.95rem;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                ${cinema.halls} salle${cinema.halls > 1 ? 's' : ''} de projection
                            </p>
                            <button class="btn btn-secondary" style="margin-top: 20px; width: 100%;" data-view="home">Voir les films a l'affiche</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}
