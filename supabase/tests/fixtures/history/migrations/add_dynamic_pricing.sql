-- 1. Add 'price' column to enrollments (to store the frozen price at time of booking)
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS price numeric;

-- 2. Add 'course_prices' column to registrations (to store the map from frontend)
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS course_prices jsonb DEFAULT '{}'::jsonb;

-- 3. Update the trigger function to use the specific price
CREATE OR REPLACE FUNCTION public.handle_registration_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  cid text;
  c_price numeric;
BEGIN
  -- Only proceed if status changed to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    
    -- Iterate through the course_ids array
    IF NEW.course_ids IS NOT NULL THEN
      FOREACH cid IN ARRAY NEW.course_ids
      LOOP
        -- Extract price from the JSONB map (default to 0 if missing)
        -- JSONB access: NEW.course_prices ->> cid
        BEGIN
            c_price := (NEW.course_prices ->> cid)::numeric;
        EXCEPTION WHEN OTHERS THEN
            c_price := 0;
        END;

        -- Insert into enrollments with the specific price
        INSERT INTO public.enrollments (registration_id, course_id, assigned_at, price)
        VALUES (NEW.id, cid, now(), c_price)
        ON CONFLICT (registration_id, course_id) 
        DO UPDATE SET price = EXCLUDED.price; -- Update price if re-confirming
      END LOOP;
    END IF;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
