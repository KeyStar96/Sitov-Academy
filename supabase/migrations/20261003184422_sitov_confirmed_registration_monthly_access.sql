-- Keep the existing atomic booking/invoice workflow and every data row intact.
-- A monthly draft or trial is not evidence that the original registration was
-- accepted. A school-set confirmed_at retains that evidence when the initial
-- next-month registration is edited or paused. Rejected registrations do not
-- grant access. The evidence must belong to the verified person.
DO $sitov$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer)'::regprocedure);
  IF position('sitov_confirmed_registration_required' IN definition) = 0 THEN
    IF position('select * into strict p from public.people where auth_user_id=auth.uid() for update;' IN definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected save_month definition; apply no partial access change';
    END IF;
    definition := replace(definition,
      'select * into strict p from public.people where auth_user_id=auth.uid() for update;',
      'select * into strict p from public.people where auth_user_id=auth.uid() for update;
 if coalesce((business_private.claim_person()->>''unresolved'')::boolean,false)
  or not exists(select 1 from public.bookings where person_id=p.id and kind=''registration'' and status<>''rejected'' and (status=''confirmed'' or confirmed_at is not null)) then
  raise exception using errcode=''42501'',message=''sitov_confirmed_registration_required'';
 end if;');
    EXECUTE definition;
  END IF;
END $sitov$;
