-- Fixes found by running the app against the schema.
--
-- Each of these was a real failure, not a tidy-up: the first three broke a
-- screen outright, and the last two made the list quietly stop being shared.

-- 1. PostgREST will only embed a table it can see a foreign key to. These
--    columns already reference auth.users, but auth.users is not readable from
--    the client, so names and avatars are read from grocery.profiles instead.
--    Without a route there, `select=..., profiles:user_id (display_name)`
--    fails with PGRST200 and the whole query 400s — members, history and the
--    item rows' "who added this" all went down together.
alter table grocery.list_members
  add constraint list_members_user_profile_fkey
  foreign key (user_id) references grocery.profiles(id) on delete cascade;

alter table grocery.trips
  add constraint trips_completed_by_profile_fkey
  foreign key (completed_by) references grocery.profiles(id) on delete set null;

alter table grocery.items
  add constraint items_added_by_profile_fkey
  foreign key (added_by) references grocery.profiles(id) on delete set null;

alter table grocery.items
  add constraint items_purchased_by_profile_fkey
  foreign key (purchased_by) references grocery.profiles(id) on delete set null;

alter table grocery.lists
  add constraint lists_owner_profile_fkey
  foreign key (owner_id) references grocery.profiles(id) on delete cascade;

-- 2. `invitations.invitee_id` was missing entirely, and accept_invitation()
--    writes it — so redeeming any invitation would have failed at runtime, on
--    the first person who ever tried to join a list.
alter table grocery.invitations
  add column if not exists invitee_id uuid references auth.users(id) on delete set null;

alter table grocery.invitations
  add constraint invitations_inviter_profile_fkey
  foreign key (inviter_id) references grocery.profiles(id) on delete cascade;

alter table grocery.invitations
  add constraint invitations_invitee_profile_fkey
  foreign key (invitee_id) references grocery.profiles(id) on delete set null;

-- 3. The invitee half of this policy read the address out of auth.users, which
--    the `authenticated` role has no privilege on. A policy runs as the
--    querying role, so every select on invitations failed with 42501 rather
--    than returning rows. The address is already in the token.
drop policy if exists invitations_read_owner_or_invitee on grocery.invitations;

create policy invitations_read_owner_or_invitee on grocery.invitations
  for select to authenticated
  using (
    grocery.is_owner(list_id)
    or invitee_id = auth.uid()
    or lower(invitee_email) = lower(nullif(auth.jwt() ->> 'email', ''))
  );

-- 4. Realtime is what makes this a shared list rather than a list two people
--    happen to have. Postgres only streams what a publication carries, and
--    supabase_realtime was empty — the client subscribed, heard nothing, and
--    silently fell back to refetch-on-focus.
alter publication supabase_realtime add table grocery.items;

-- 5. Without a full replica identity the payload for an UPDATE or DELETE
--    carries only the primary key, so the client's row filter (trip_id=eq.N)
--    has nothing to match on.
alter table grocery.items replica identity full;

-- 6. The aisle list is a closed set and the client sorts by its position, so an
--    unknown key would sort last and render without an icon. Reject it here
--    rather than discovering it in the UI. Mirrors src/lib/categories.js.
alter table grocery.items
  add constraint items_category_key_check check (category_key in (
    'produce', 'bakery', 'dairy_eggs', 'meat_fish', 'pantry', 'frozen',
    'snacks_sweets', 'beverages', 'alcohol', 'baby', 'household',
    'disposables', 'personal_care', 'other'
  ));
