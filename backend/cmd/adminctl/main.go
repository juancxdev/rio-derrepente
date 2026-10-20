// Command adminctl bootstraps platform identities without storing passwords in
// source control, .env files, or Docker Compose defaults.
package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"net/mail"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/juancx/tourism-platform/backend/internal/adapters/auth"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"golang.org/x/term"
)

const minimumPasswordLength = 12

func main() {
	if len(os.Args) < 2 || os.Args[1] != "create-superadmin" {
		usage()
		os.Exit(2)
	}
	if err := createSuperAdmin(os.Args[2:]); err != nil {
		fmt.Fprintln(os.Stderr, "adminctl:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `Uso:
  adminctl create-superadmin --email <correo> [--name <nombre>] [--generate | --password-stdin]

Sin --generate ni --password-stdin, la contraseña se solicita de forma oculta.
No hay contraseña por defecto.

Ejemplo:
  docker compose --profile tools run --rm adminctl create-superadmin --email superadmin@example.com`)
}

func createSuperAdmin(args []string) error {
	flags := flag.NewFlagSet("create-superadmin", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	email := flags.String("email", "", "correo del super administrador")
	name := flags.String("name", "Super administrador", "nombre visible")
	generate := flags.Bool("generate", false, "generar una contraseña aleatoria y mostrarla una vez")
	passwordStdin := flags.Bool("password-stdin", false, "leer la contraseña desde stdin")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *generate && *passwordStdin {
		return fmt.Errorf("--generate y --password-stdin son mutuamente excluyentes")
	}
	*email = strings.ToLower(strings.TrimSpace(*email))
	parsed, err := mail.ParseAddress(*email)
	if err != nil || parsed.Address != *email {
		return fmt.Errorf("correo inválido")
	}

	var password string
	switch {
	case *generate:
		password, err = randomPassword()
	case *passwordStdin:
		password, err = readStdinPassword()
	default:
		password, err = promptPassword()
	}
	if err != nil {
		return err
	}
	if len(password) < minimumPasswordLength {
		return fmt.Errorf("la contraseña debe tener al menos %d caracteres", minimumPasswordLength)
	}

	dsn, err := databaseURL()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	repos, err := postgres.New(ctx, dsn)
	if err != nil {
		return err
	}
	defer repos.Close()
	if err := repos.Pool.Ping(ctx); err != nil {
		return err
	}

	service := application.NewAuthService(repos, nil, auth.BcryptHasher{}, nil, time.Hour)
	user, err := service.EnsureSuperAdmin(ctx, *email, password, *name)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Super administrador listo: %s (%s)\n", user.Email, user.ID)
	if *generate {
		fmt.Println(password)
	}
	return nil
}

func databaseURL() (string, error) {
	if value := strings.TrimSpace(os.Getenv("DATABASE_URL")); value != "" {
		return value, nil
	}
	return "", fmt.Errorf("DATABASE_URL es obligatorio")
}

func randomPassword() (string, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func readStdinPassword() (string, error) {
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && strings.TrimSpace(line) == "" {
		return "", fmt.Errorf("no se pudo leer la contraseña desde stdin")
	}
	return strings.TrimSpace(line), nil
}

func promptPassword() (string, error) {
	if !term.IsTerminal(int(syscall.Stdin)) {
		return "", fmt.Errorf("stdin no es una terminal; usa --generate o --password-stdin")
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
