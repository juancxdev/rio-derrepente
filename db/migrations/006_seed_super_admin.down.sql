-- Revertir la migración del super administrador.
-- Nota: esto desactiva el usuario pero no lo elimina para preservar auditoría.
UPDATE users SET active = false, is_super_admin = false WHERE lower(email) = lower('admin@example.com');
