// Script para generar una migración SQL con el super administrador.
// Uso: go run ./cmd/generate-superadmin-migration --email admin@example.com --password "MiPassword123" [--name "Super Admin"]
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

const (
	minPasswordLength = 12
)

func main() {
	email := flag.String("email", "", "Email del super administrador")
	password := flag.String("password", "", "Contraseña (si no se proporciona, se solicitará interactivamente)")
	name := flag.String("name", "Super administrador", "Nombre visible")
	flag.Parse()

	if *email == "" {
		fmt.Fprintln(os.Stderr, "Error: --email es obligatorio")
		flag.Usage()
		os.Exit(1)
	}

	*email = strings.ToLower(strings.TrimSpace(*email))
	if !strings.Contains(*email, "@") {
		fmt.Fprintln(os.Stderr, "Error: email inválido")
		os.Exit(1)
	}

	var pass string
	if *password != "" {
		pass = *password
	} else {
		var err error
		pass, err = promptPassword()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error al leer contraseña: %v\n", err)
			os.Exit(1)
		}
	}

	if len(pass) < minPasswordLength {
		fmt.Fprintf(os.Stderr, "Error: la contraseña debe tener al menos %d caracteres\n", minPasswordLength)
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error al generar hash: %v\n", err)
		os.Exit(1)
	}

	migrationsPath, err := findMigrationsDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error al localizar las migraciones: %v\n", err)
		os.Exit(1)
	}

	migrationNum, err := getNextMigrationNumber(migrationsPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error al determinar número de migración: %v\n", err)
		os.Exit(1)
	}

	upFile := filepath.Join(migrationsPath, fmt.Sprintf("%03d_seed_super_admin.up.sql", migrationNum))
	downFile := filepath.Join(migrationsPath, fmt.Sprintf("%03d_seed_super_admin.down.sql", migrationNum))

	upContent := fmt.Sprintf(`-- Migración generada automáticamente para crear/actualizar el super administrador.
-- Email: %s
-- Nombre: %s
-- Generada con: backend/cmd/generate-superadmin-migration

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Intentar encontrar el usuario existente
  SELECT id INTO v_user_id FROM users WHERE lower(email) = lower('%s');
  
  IF v_user_id IS NULL THEN
    -- Crear nuevo usuario
    INSERT INTO users (id, email, password_hash, display_name, active, is_super_admin)
    VALUES (
      gen_random_uuid(),
      '%s',
      '%s',
      '%s',
      true,
      true
    )
    RETURNING id INTO v_user_id;
  ELSE
    -- Actualizar usuario existente
    UPDATE users SET
      password_hash = '%s',
      display_name = '%s',
      active = true,
      is_super_admin = true
    WHERE id = v_user_id;
  END IF;
END $$;
`, *email, *name, *email, *email, string(hash), *name, string(hash), *name)

	downContent := fmt.Sprintf(`-- Revertir la migración del super administrador.
-- Nota: esto desactiva el usuario pero no lo elimina para preservar auditoría.
UPDATE users SET active = false, is_super_admin = false WHERE lower(email) = lower('%s');
`, *email)

	if err := os.WriteFile(upFile, []byte(upContent), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error al escribir %s: %v\n", upFile, err)
		os.Exit(1)
	}

	if err := os.WriteFile(downFile, []byte(downContent), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error al escribir %s: %v\n", downFile, err)
		os.Exit(1)
	}

	fmt.Printf("✓ Migraciones generadas:\n")
	fmt.Printf("  %s\n", upFile)
	fmt.Printf("  %s\n", downFile)
	fmt.Printf("\nEmail: %s\n", *email)
	fmt.Printf("Nombre: %s\n", *name)
	fmt.Printf("\nPróximos pasos:\n")
	fmt.Printf("  1. Revisa los archivos generados\n")
	fmt.Printf("  2. Commit al repositorio\n")
	fmt.Printf("  3. Ejecuta: docker compose --profile tools run --rm migrate\n")
}

func promptPassword() (string, error) {
	if !term.IsTerminal(int(syscall.Stdin)) {
		return "", fmt.Errorf("stdin no es una terminal; usa --password")
	}
	fmt.Fprint(os.Stderr, "Contraseña: ")
	first, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	fmt.Fprint(os.Stderr, "Repite la contraseña: ")
	second, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	if string(first) != string(second) {
		return "", fmt.Errorf("las contraseñas no coinciden")
	}
	return string(first), nil
}

func findMigrationsDir() (string, error) {
	candidates := []string{
		"db/migrations",    // ejecución desde la raíz del proyecto
		"../db/migrations", // ejecución desde backend
	}

	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("no se encontró db/migrations desde %s", mustGetwd())
}

func mustGetwd() string {
	workingDir, err := os.Getwd()
	if err != nil {
		return "directorio actual"
	}
	return workingDir
}

func getNextMigrationNumber(migrationsDir string) (int, error) {
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return 0, err
	}

	maxNum := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if len(name) < 3 {
			continue
		}
		// Extraer los primeros 3 dígitos
		prefix := name[:3]
		var num int
		if _, err := fmt.Sscanf(prefix, "%d", &num); err == nil {
			if num > maxNum {
				maxNum = num
			}
		}
	}

	return maxNum + 1, nil
}
