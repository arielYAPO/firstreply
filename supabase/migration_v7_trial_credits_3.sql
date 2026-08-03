-- FirstReply V7 : essai gratuit ramené de 10 à 3 crédits.
--
-- POURQUOI
-- Sur les 29 utilisateurs activés de la première cohorte, aucun n'a épuisé
-- ses 10 crédits (consommation maximale observée : 8). Le paywall n'a donc
-- jamais été rencontré : 0 utilisateur sur 55. Impossible d'apprendre quoi
-- que ce soit sur la disposition à payer.
-- À 3 crédits, les 6 utilisateurs qui consomment 4 crédits ou plus
-- rencontrent le prix, sans que les 72 % qui s'arrêtent d'eux-mêmes avant
-- la 3e analyse ne soient affectés.
--
-- PÉRIMÈTRE
-- Cette migration ne modifie QUE le trigger d'inscription. Elle ne touche
-- à aucun compte existant, à aucun solde existant, à aucune autre table.
-- Les 55 utilisateurs actuels gardent exactement ce qu'ils ont.
--
-- RÉVERSIBILITÉ
-- Le retour arrière est en bas de ce fichier. Il suffit de le réexécuter
-- pour repasser à 10.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    )
  )
  on conflict (id) do nothing;

  insert into public.credit_balances (user_id, credits)
  values (new.id, 3)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

comment on function public.handle_new_user() is
  'Creates a FirstReply profile and grants 3 trial credits to a new auth user.';


-- ---------------------------------------------------------------------------
-- VÉRIFICATION (à exécuter après la migration, ne modifie rien)
-- ---------------------------------------------------------------------------
-- Doit renvoyer une ligne contenant "values (new.id, 3)" :
--
--   select prosrc from pg_proc where proname = 'handle_new_user';
--
-- Doit renvoyer le nombre de comptes existants, inchangé :
--
--   select credits, count(*) from public.credit_balances group by credits
--   order by credits;


-- ---------------------------------------------------------------------------
-- RETOUR ARRIÈRE — repasser à 10 crédits
-- ---------------------------------------------------------------------------
-- Décommenter le bloc ci-dessous et l'exécuter seul.
--
-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- begin
--   insert into public.profiles (id, email, full_name)
--   values (
--     new.id,
--     new.email,
--     coalesce(
--       new.raw_user_meta_data->>'full_name',
--       new.raw_user_meta_data->>'name',
--       ''
--     )
--   )
--   on conflict (id) do nothing;
--
--   insert into public.credit_balances (user_id, credits)
--   values (new.id, 10)
--   on conflict (user_id) do nothing;
--
--   return new;
-- end;
-- $$;
--
-- revoke all on function public.handle_new_user()
--   from public, anon, authenticated;
