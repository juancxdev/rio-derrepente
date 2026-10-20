-- Migración generada automáticamente para crear/actualizar el super administrador.
-- Email: admin@example.com
-- Nombre: Super administrador
-- Generada con: backend/cmd/generate-superadmin-migration

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Intentar encontrar el usuario existente
  SELECT id INTO v_user_id FROM users WHERE lower(email) = lower('admin@example.com');
  
  IF v_user_id IS NULL THEN
    -- Crear nuevo usuario
    INSERT INTO users (id, email, password_hash, display_name, active, is_super_admin)
    VALUES (
      gen_random_uuid(),
      'admin@example.com',
      '$2a$10$VBtu6zVUjlq/7L83aGd4xO1GJDbvj8Fc1P.ROw3fQfK8gVUqpj3.K',
      'Super administrador',
      true,
      true
    )
    RETURNING id INTO v_user_id;
  ELSE
    -- Actualizar usuario existente
    UPDATE users SET
      password_hash = '$2a$10$VBtu6zVUjlq/7L83aGd4xO1GJDbvj8Fc1P.ROw3fQfK8gVUqpj3.K',
      display_name = 'Super administrador',
      active = true,
      is_super_admin = true
    WHERE id = v_user_id;
  END IF;
END $$;
