-- Take admin's reach back out of the ordinary tables.
--
-- These six policies widened SELECT for an admin on every table, on the
-- assumption that the admin panel would read the tables directly. It does not:
-- admin_overview, admin_users and admin_lists are SECURITY DEFINER, so they
-- already bypass RLS entirely and never needed them.
--
-- What the policies did instead was leak. The app asks for "my lists" by
-- selecting list_members with no filter and letting RLS narrow the result, so
-- the moment the signed-in user was an admin that came back with every
-- household's rows — and the list switcher showed the owner a list of everyone
-- who had ever signed up.
--
-- Measured before removal: as the admin, an unfiltered read returned 3 rows
-- across lists 9, 12 and 13. As an ordinary member it returned 0, so no
-- ordinary user was ever affected.
--
-- The client query now narrows itself as well; see useGroceryLists. Both
-- halves are asserted in supabase/tests/rls.sql.

drop policy if exists profiles_read_admin     on grocery.profiles;
drop policy if exists lists_read_admin        on grocery.lists;
drop policy if exists list_members_read_admin on grocery.list_members;
drop policy if exists trips_read_admin        on grocery.trips;
drop policy if exists items_read_admin        on grocery.items;
drop policy if exists invitations_read_admin  on grocery.invitations;

-- `admins_read_self` stays: useIsAdmin reads that table directly to decide
-- whether to show the entrance, and it only ever returns rows to an admin.
