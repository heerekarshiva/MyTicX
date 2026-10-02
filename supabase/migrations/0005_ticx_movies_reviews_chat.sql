-- ============================================================================
-- TICX migration 0005: language + shared movie posters, reviews, chat cleanup,
-- and a marketplace view that actually shows movie/poster/language.
-- Safe to run more than once.
-- ============================================================================

-- One movie row per (title, language) so a poster uploaded once is reused by
-- every later seller of the same movie.
create unique index if not exists uq_movies_title_lang
  on movies (lower(title), lower(coalesce(language, '')));

create unique index if not exists uq_theatres_name_loc
  on theatres (lower(name), location_id);

-- Public bucket for movie posters (posters are not sensitive).
insert into storage.buckets (id, name, public)
values ('movie-posters', 'movie-posters', true)
on conflict (id) do nothing;

-- Reviews: one per order, written by the buyer about the seller.
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id)
);
create index if not exists idx_reviews_seller on reviews(seller_id);
alter table reviews enable row level security;
drop policy if exists reviews_select_public on reviews;
create policy reviews_select_public on reviews for select using (true);
-- No client insert policy: reviews are written only by /api/reviews (service role).

-- Marketplace view, now with movie id, language and poster.
drop view if exists marketplace_listings_view;
create view marketplace_listings_view as
select
  tl.id as listing_id,
  tl.resale_price,
  tl.platform_fee,
  tl.status,
  tl.created_at,
  t.original_price,
  t.seat_label,
  t.verification_status,
  m.id as movie_id,
  m.title as movie_title,
  m.language as language,
  m.poster_url as poster_url,
  th.name as theatre_name,
  loc.city as location,
  s.show_date,
  s.show_time,
  p.phone_verified as seller_phone_verified,
  tl.seller_id
from ticket_listings tl
join tickets t on t.id = tl.ticket_id
left join shows s on s.id = t.show_id
left join movies m on m.id = s.movie_id
left join theatres th on th.id = s.theatre_id
left join locations loc on loc.id = th.location_id
join profiles p on p.id = tl.seller_id;
alter view marketplace_listings_view set (security_invoker = true);

-- Chat cleanup: delete a listing's messages once (a) the buyer has reviewed the
-- sale, or (b) the show is over. Times are compared in India time.
create or replace function purge_finished_chats() returns int
language plpgsql as $$
declare n1 int; n2 int;
begin
  delete from messages m
  using ticket_listings tl
  where m.listing_id = tl.id
    and exists (
      select 1 from orders o join reviews r on r.order_id = o.id
      where o.listing_id = tl.id
    );
  get diagnostics n1 = row_count;

  delete from messages m
  using ticket_listings tl, tickets t, shows s
  where m.listing_id = tl.id
    and t.id = tl.ticket_id
    and s.id = t.show_id
    and ((s.show_date + s.show_time) at time zone 'Asia/Kolkata') < now() - interval '3 hours';
  get diagnostics n2 = row_count;

  return n1 + n2;
end;
$$;
