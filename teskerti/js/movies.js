import { DATA } from './data.js';

export function renderHome(container) {
    const movies = DATA.movies;
    if (!movies.length) {
        container.innerHTML = '<div class="container" style="padding: 100px 0; text-align: center;">Chargement des films...</div>';
        return;
    }
    
    const heroMovie = movies.find(m => m.id === 1) || movies[0]; 
    
    const html = `
        <section class="hero" style="background-image: url('${heroMovie.heroBg}');">
            <div class="container hero-content">
                <div class="hero-meta">
                    <span class="tag tag-en-salle">EN SALLE</span>
                    <span class="tag tag-genre">${heroMovie.genre}</span>
                    <span style="color: var(--white); font-weight: 500;">${heroMovie.year} -- ${heroMovie.duration} min</span>
                </div>
                <h1 class="hero-title">${heroMovie.title}</h1>
                <p style="color: var(--cream); margin-bottom: 30px; max-width: 600px; font-size: 1.1rem; line-height: 1.6; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
                    ${heroMovie.synopsis}
                </p>
                <div class="hero-actions">
                    <button class="btn btn-primary" data-view="booking" data-id="${heroMovie.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                        Reserver maintenant
                    </button>
                    <button class="btn btn-secondary">Bande-annonce</button>
                </div>
            </div>
        </section>

        <section class="container">
            <h2 class="section-title">A l'affiche</h2>
            <div class="movies-grid">
                ${movies.map(movie => `
                    <div class="movie-card" data-view="booking" data-id="${movie.id}">
                        <div class="movie-poster">
                            <img src="${movie.poster}" alt="${movie.title}" loading="lazy">
                            <div class="movie-overlay">
                                <p class="movie-overlay-synopsis">${movie.synopsis}</p>
                                <button class="btn btn-primary" style="width: 100%;">Reserver un billet</button>
                            </div>
                        </div>
                        <div class="movie-info">
                            <h3>${movie.title}</h3>
                            <div class="movie-meta">
                                <span class="text-gold">${movie.genre}</span> -- <span>${movie.duration} min</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;

    container.innerHTML = html;
}
