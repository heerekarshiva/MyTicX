import 'server-only';

export interface ShowResult {
  movieId: string;
  movieTitle: string;
  language: string;
  genre: string;
  durationMinutes: number;
  rating: string | null;
  posterUrl: string;
  theatreId: string;
  theatreName: string;
  location: string;
  showDate: string;   // YYYY-MM-DD
  showTimes: string[]; // HH:mm
  basePrice: number;
}

export interface MovieProvider {
  searchShows(query: { movie: string; location: string }): Promise<ShowResult[]>;
  getShowById(showId: string): Promise<ShowResult | null>;
}

/**
 * Demo/development provider. Returns realistic, clearly-labeled sample data
 * so the app is fully usable without a real movie-data contract in place.
 * Swap MOVIE_API_PROVIDER=tmdb (or a real box-office/cinema partner API) and
 * implement a matching class below without touching any call sites.
 */
class MockMovieProvider implements MovieProvider {
  private sample: ShowResult[] = [
    {
      movieId: 'mv_paradise', movieTitle: 'Paradise', language: 'Telugu',
      genre: 'Drama / Thriller', durationMinutes: 130, rating: 'U/A',
      posterUrl: '/posters/placeholder-1.svg',
      theatreId: 'th_pvr_hyd', theatreName: 'PVR Cinemas', location: 'Hyderabad',
      showDate: new Date().toISOString().slice(0, 10),
      showTimes: ['17:30', '19:30', '22:00'], basePrice: 350
    },
    {
      movieId: 'mv_orbit', movieTitle: 'Orbit Rising', language: 'English',
      genre: 'Sci-Fi / Action', durationMinutes: 142, rating: 'U/A',
      posterUrl: '/posters/placeholder-2.svg',
      theatreId: 'th_inox_hyd', theatreName: 'INOX GVK', location: 'Hyderabad',
      showDate: new Date().toISOString().slice(0, 10),
      showTimes: ['14:00', '18:15', '21:45'], basePrice: 400
    },
    {
      movieId: 'mv_monsoon', movieTitle: 'Monsoon Diaries', language: 'Hindi',
      genre: 'Romance / Drama', durationMinutes: 118, rating: 'U',
      posterUrl: '/posters/placeholder-3.svg',
      theatreId: 'th_amb_hyd', theatreName: 'AMB Cinemas', location: 'Hyderabad',
      showDate: new Date().toISOString().slice(0, 10),
      showTimes: ['11:00', '16:00', '20:00'], basePrice: 300
    }
  ];

  async searchShows(query: { movie: string; location: string }): Promise<ShowResult[]> {
    const movie = query.movie.trim().toLowerCase();
    const location = query.location.trim().toLowerCase();
    return this.sample.filter(s =>
      (!movie || s.movieTitle.toLowerCase().includes(movie)) &&
      (!location || s.location.toLowerCase().includes(location))
    );
  }

  async getShowById(showId: string): Promise<ShowResult | null> {
    return this.sample.find(s => s.movieId === showId) ?? null;
  }
}

export function getMovieProvider(): MovieProvider {
  const provider = process.env.MOVIE_API_PROVIDER ?? 'mock';
  switch (provider) {
    case 'mock':
    default:
      // TODO: add a real adapter (e.g. TmdbMovieProvider / CinemaPartnerProvider)
      // implementing the same MovieProvider interface, then branch on it here.
      return new MockMovieProvider();
  }
}
