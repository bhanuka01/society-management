-- Migration: Normalize student IDs to SC/202x/xxxxx format and alter foreign keys
-- Run this in your Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

DO $$
DECLARE
    r RECORD;
    sql_stmt TEXT;
BEGIN
    FOR r IN (
        SELECT 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name, 
            ccu.column_name AS foreign_column_name,
            con.confdeltype
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN pg_constraint con
              ON con.conname = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'members'
          AND ccu.column_name = 'st_id'
          AND tc.table_schema = 'public'
    ) LOOP
        -- Drop the old constraint
        sql_stmt := 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        RAISE NOTICE 'Executing: %', sql_stmt;
        EXECUTE sql_stmt;

        -- Determine the delete action
        DECLARE
            delete_action TEXT;
        BEGIN
            IF r.confdeltype = 'c' THEN
                delete_action := 'ON DELETE CASCADE';
            ELSIF r.confdeltype = 'n' THEN
                delete_action := 'ON DELETE SET NULL';
            ELSE
                delete_action := 'ON DELETE NO ACTION';
            END IF;

            -- Re-create the constraint with ON UPDATE CASCADE
            sql_stmt := 'ALTER TABLE ' || quote_ident(r.table_name) || 
                        ' ADD CONSTRAINT ' || quote_ident(r.constraint_name) || 
                        ' FOREIGN KEY (' || quote_ident(r.column_name) || ') REFERENCES public.members(st_id) ' || 
                        delete_action || ' ON UPDATE CASCADE';
            RAISE NOTICE 'Executing: %', sql_stmt;
            EXECUTE sql_stmt;
        END;
    END LOOP;
END $$;

-- 2. Update existing member IDs to 'SC/202x/xxxxx' format
-- Converts any 'sc/yyyy/nnnnn' or 'yyyy/nnnnn' to 'SC/yyyy/nnnnn'
UPDATE public.members
SET st_id = 'SC/' || regexp_replace(st_id, '^sc\/', '', 'i')
WHERE st_id NOT LIKE 'SC/%';

-- 3. Update existing event registrations IDs to 'SC/202x/xxxxx' format
UPDATE public.event_registrations
SET st_id = 'SC/' || regexp_replace(st_id, '^sc\/', '', 'i')
WHERE st_id NOT LIKE 'SC/%';

-- Reload schema cache to reflect updates
NOTIFY pgrst, 'reload schema';
