import { CONFIG } from './config.js';

export const DATA = {
    movies: [],
    cinemas: [],
    pricing: {
        normal:  { label: "Normal",   price: 15.000 },
        senior:  { label: "Senior",   price: 12.000 },
        student: { label: "Etudiant", price: 12.000 },
        child:   { label: "Enfant",   price: 10.000 }
    }
};

export async function initData() {
    try {
        const [moviesRes, cinemasRes] = await Promise.all([
            fetch(`${CONFIG.API_BASE_URL}/movies`).then(r => r.json()),
            fetch(`${CONFIG.API_BASE_URL}/cinemas`).then(r => r.json())
        ]);

        if (moviesRes.success) {
            DATA.movies = moviesRes.data.map(m => ({
                id: m.id,
                title: m.title_fr || m.title_ar,
                year: parseInt(m.release_date.split('-')[0]),
                genre: m.genre,
                duration: m.duration_min,
                director: m.director,
                synopsis: m.synopsis,
                poster: m.poster_url || "https://via.placeholder.com/600x900",
                heroBg: m.hero_bg_url || "https://via.placeholder.com/1920x1080",
                nowPlaying: m.is_active === 1
            }));
        }

        if (cinemasRes.success) {
            DATA.cinemas = cinemasRes.data.map(c => ({
                id: c.id,
                name: c.name,
                address: c.address,
                city: c.city,
                halls: c.halls || 1,
                image: c.image_url || "https://via.placeholder.com/800x600"
            }));
        }
    } catch(e) {
        console.error("Failed to load initial data:", e);
    }
}
