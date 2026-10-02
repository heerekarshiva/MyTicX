-- Sample reference data for local development. Run after schema.sql.
insert into locations (city, state, country) values ('Hyderabad', 'Telangana', 'IN')
  on conflict do nothing;

insert into theatres (name, location_id)
select 'PVR Cinemas', id from locations where city = 'Hyderabad'
on conflict do nothing;

insert into movies (title, language, genre, duration_minutes, rating, poster_url)
values ('Paradise', 'Telugu', 'Drama / Thriller', 130, 'U/A', '/posters/placeholder-1.svg')
on conflict do nothing;

insert into shows (movie_id, theatre_id, show_date, show_time, base_price)
select m.id, t.id, current_date, '19:30', 350
from movies m, theatres t
where m.title = 'Paradise' and t.name = 'PVR Cinemas'
limit 1;

-- Note: profiles/tickets/listings are created through the app (they need a
-- real auth.users row), so they are intentionally not seeded here.
