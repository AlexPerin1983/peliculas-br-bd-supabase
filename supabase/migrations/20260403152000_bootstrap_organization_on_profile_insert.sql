CREATE OR REPLACE FUNCTION public.bootstrap_organization_for_profile()
RETURNS TRIGGER AS $$
DECLARE
    existing_org_id UUID;
    new_org_id UUID;
    normalized_name TEXT;
BEGIN
    IF NEW.organization_id IS NOT NULL OR NEW.approved IS DISTINCT FROM true THEN
        RETURN NEW;
    END IF;

    SELECT id
    INTO existing_org_id
    FROM organizations
    WHERE owner_id = NEW.id
    LIMIT 1;

    IF existing_org_id IS NOT NULL THEN
        UPDATE profiles
        SET organization_id = existing_org_id
        WHERE id = NEW.id;

        INSERT INTO organization_members (
            organization_id,
            user_id,
            email,
            role,
            status,
            joined_at
        ) VALUES (
            existing_org_id,
            NEW.id,
            NEW.email,
            'owner',
            'active',
            now()
        )
        ON CONFLICT (organization_id, email) DO UPDATE
        SET
            user_id = EXCLUDED.user_id,
            role = 'owner',
            status = 'active',
            joined_at = COALESCE(organization_members.joined_at, EXCLUDED.joined_at);

        RETURN NEW;
    END IF;

    normalized_name := NULLIF(
        INITCAP(
            REGEXP_REPLACE(
                SPLIT_PART(COALESCE(NEW.email, 'Minha Empresa'), '@', 1),
                '[._-]+',
                ' ',
                'g'
            )
        ),
        ''
    );

    INSERT INTO organizations (name, owner_id)
    VALUES (COALESCE(normalized_name, 'Minha Empresa'), NEW.id)
    RETURNING id INTO new_org_id;

    UPDATE profiles
    SET organization_id = new_org_id
    WHERE id = NEW.id;

    INSERT INTO organization_members (
        organization_id,
        user_id,
        email,
        role,
        status,
        joined_at
    ) VALUES (
        new_org_id,
        NEW.id,
        NEW.email,
        'owner',
        'active',
        now()
    )
    ON CONFLICT (organization_id, email) DO UPDATE
    SET
        user_id = EXCLUDED.user_id,
        role = 'owner',
        status = 'active',
        joined_at = COALESCE(organization_members.joined_at, EXCLUDED.joined_at);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_bootstrap_organization ON profiles;
CREATE TRIGGER on_profile_created_bootstrap_organization
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.bootstrap_organization_for_profile();

DO $$
DECLARE
    profile_record RECORD;
    existing_org_id UUID;
    new_org_id UUID;
    normalized_name TEXT;
BEGIN
    FOR profile_record IN
        SELECT id, email
        FROM profiles
        WHERE approved = true
          AND organization_id IS NULL
    LOOP
        SELECT id
        INTO existing_org_id
        FROM organizations
        WHERE owner_id = profile_record.id
        LIMIT 1;

        IF existing_org_id IS NULL THEN
            normalized_name := NULLIF(
                INITCAP(
                    REGEXP_REPLACE(
                        SPLIT_PART(COALESCE(profile_record.email, 'Minha Empresa'), '@', 1),
                        '[._-]+',
                        ' ',
                        'g'
                    )
                ),
                ''
            );

            INSERT INTO organizations (name, owner_id)
            VALUES (COALESCE(normalized_name, 'Minha Empresa'), profile_record.id)
            RETURNING id INTO new_org_id;
        ELSE
            new_org_id := existing_org_id;
        END IF;

        UPDATE profiles
        SET organization_id = new_org_id
        WHERE id = profile_record.id;

        INSERT INTO organization_members (
            organization_id,
            user_id,
            email,
            role,
            status,
            joined_at
        ) VALUES (
            new_org_id,
            profile_record.id,
            profile_record.email,
            'owner',
            'active',
            now()
        )
        ON CONFLICT (organization_id, email) DO UPDATE
        SET
            user_id = EXCLUDED.user_id,
            role = 'owner',
            status = 'active',
            joined_at = COALESCE(organization_members.joined_at, EXCLUDED.joined_at);
    END LOOP;
END;
$$;
