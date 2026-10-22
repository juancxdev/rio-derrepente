package httpadapter

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	authadapter "github.com/juancx/tourism-platform/backend/internal/adapters/auth"
	"github.com/juancx/tourism-platform/backend/internal/adapters/logging"
	"github.com/juancx/tourism-platform/backend/internal/adapters/postgres"
	"github.com/juancx/tourism-platform/backend/internal/adapters/weather"
	"github.com/juancx/tourism-platform/backend/internal/application"
	"github.com/juancx/tourism-platform/backend/internal/domain/closures"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
	"github.com/juancx/tourism-platform/backend/internal/domain/predictions"
	"github.com/juancx/tourism-platform/backend/internal/domain/sites"
	"github.com/juancx/tourism-platform/backend/internal/domain/tenants"
	"github.com/juancx/tourism-platform/backend/internal/domain/tickets"
	"github.com/juancx/tourism-platform/backend/internal/domain/visits"
)

type memoryVisits struct{ duplicate bool }

func (m memoryVisits) Create(_ context.Context, v visits.Record) (visits.Record, error) {
	if m.duplicate {
		return visits.Record{}, postgres.ErrDuplicate
	}
	v.ID = 1
	return v, nil
}

type noopPublisher struct{}

func (noopPublisher) PublishVisitCreated(context.Context, visits.Record) error { return nil }

type missingPredictions struct{}

func (missingPredictions) FindByDate(context.Context, uuid.UUID, time.Time) (predictions.Prediction, error) {
	return predictions.Prediction{}, postgres.ErrNotFound
}

type ticketingScopeStub struct {
	owns      bool
	sites     []sites.Site
	closure   closures.Status
	sold      []tickets.Ticket
	lastKey   string
	importErr error
}

func (s *ticketingScopeStub) CreateTenant(_ context.Context, t tenants.Tenant) (tenants.Tenant, error) {
	return t, nil
}
func (s *ticketingScopeStub) CreateSite(_ context.Context, site sites.Site) (sites.Site, error) {
	return site, nil
}
func (s *ticketingScopeStub) ListSites(context.Context, uuid.UUID) ([]sites.Site, error) {
	return s.sites, nil
}
func (s *ticketingScopeStub) FindSite(_ context.Context, tenantID, siteID uuid.UUID) (sites.Site, error) {
	if !s.owns {
		return sites.Site{}, postgres.ErrScopeNotFound
	}
	return sites.Site{ID: siteID, TenantID: tenantID, Latitude: 12.34, Longitude: 56.78, Timezone: "America/New_York"}, nil
}
func (s *ticketingScopeStub) ScopeExists(context.Context, uuid.UUID, uuid.UUID) bool { return s.owns }
func (s *ticketingScopeStub) CreateTickets(_ context.Context, tenantID, siteID uuid.UUID, day time.Time, quantity int, key string) ([]tickets.Ticket, error) {
	s.lastKey = key
	if s.sold != nil {
		return s.sold, nil
	}
	out := make([]tickets.Ticket, quantity)
	for i := range out {
		out[i] = tickets.New(tenantID, siteID, day, uuid.NewString())
	}
	return out, nil
}
func (s *ticketingScopeStub) ImportHistorical(context.Context, uuid.UUID, uuid.UUID, string, []visits.Record) error {
	return s.importErr
}
func (s *ticketingScopeStub) ClosureStatus(_ context.Context, _, _ uuid.UUID, day time.Time) (closures.Status, error) {
	status := s.closure
	status.Date = day.Format("2006-01-02")
	return status, nil
}

type fixedWeather struct{}

func (fixedWeather) Forecasts(_ context.Context, _ float64, _ float64, target time.Time, days int) ([]weather.Forecast, error) {
	result := make([]weather.Forecast, days)
	for i := range result {
		result[i] = weather.Forecast{Date: target.AddDate(0, 0, i), TemperatureMax: 30, PrecipitationMM: 2, PrecipitationProbability: 45, WeatherCode: 3}
	}
	return result, nil
}
func (fixedWeather) Historical(_ context.Context, _ float64, _ float64, target time.Time, days int) ([]weather.Forecast, error) {
	result := make([]weather.Forecast, days)
	for i := range result {
		result[i] = weather.Forecast{Date: target.AddDate(0, 0, i), TemperatureMax: 29, PrecipitationMM: 1, WeatherCode: 51}
	}
	return result, nil
}

type coordinatesWeather struct{ latitude, longitude float64 }

func (w *coordinatesWeather) Forecasts(_ context.Context, latitude, longitude float64, target time.Time, days int) ([]weather.Forecast, error) {
	w.latitude, w.longitude = latitude, longitude
	return fixedWeather{}.Forecasts(context.Background(), latitude, longitude, target, days)
}
func (w *coordinatesWeather) Historical(_ context.Context, latitude, longitude float64, target time.Time, days int) ([]weather.Forecast, error) {
	w.latitude, w.longitude = latitude, longitude
	return fixedWeather{}.Historical(context.Background(), latitude, longitude, target, days)
}

type passwordStub struct{}

func (passwordStub) Hash(plain string) (string, error) { return "hash:" + plain, nil }
func (passwordStub) Verify(hash, plain string) bool    { return hash == "hash:"+plain }

type identityStub struct {
	user       identity.User
	membership identity.Membership
}

func (s identityStub) FindUserByEmail(_ context.Context, email string) (identity.User, error) {
	if strings.EqualFold(email, s.user.Email) {
		return s.user, nil
	}
	return identity.User{}, identity.ErrUserNotFound
}
func (s identityStub) FindUserByID(_ context.Context, id uuid.UUID) (identity.User, error) {
	if id == s.user.ID {
		return s.user, nil
	}
	return identity.User{}, identity.ErrUserNotFound
}
func (s identityStub) Memberships(context.Context, uuid.UUID) ([]identity.Membership, error) {
	return []identity.Membership{s.membership}, nil
}
func (s identityStub) Membership(_ context.Context, userID, tenantID uuid.UUID) (identity.Membership, error) {
	if userID == s.membership.UserID && tenantID == s.membership.TenantID {
		return s.membership, nil
	}
	return identity.Membership{}, identity.ErrMembershipNotFound
}
func (s identityStub) UpsertUser(_ context.Context, user identity.User) (identity.User, error) {
	return user, nil
}
func (s identityStub) UpsertMembership(context.Context, identity.Membership) error { return nil }

type authFixture struct {
	app       *fiber.App
	ticketing *ticketingScopeStub
	tokens    authadapter.TokenManager
	userID    uuid.UUID
	tenantID  uuid.UUID
	email     string
	password  string
}

func newAuthFixture(active bool, role identity.Role, owns bool) *authFixture {
	userID, tenantID := uuid.New(), uuid.New()
	repo := identityStub{
		user:       identity.User{ID: userID, Email: "operador@example.com", DisplayName: "Operador", PasswordHash: "hash:clave-segura", Active: active},
		membership: identity.Membership{UserID: userID, TenantID: tenantID, TenantName: "Operador turístico", Role: role},
	}
	tokens := authadapter.TokenManager{Secret: []byte("test-secret"), TTL: time.Hour}
	ticketing := &ticketingScopeStub{owns: owns, sites: []sites.Site{{ID: uuid.New(), TenantID: tenantID, Code: "derrepente", Name: "Catarata", Timezone: "America/Lima"}}}
	service := application.NewAuthService(repo, ticketing, passwordStub{}, tokens, time.Hour)
	app := New(application.NewRegisterVisitService(memoryVisits{}, noopPublisher{}), application.NewGetPredictionService(missingPredictions{}), fixedWeather{}, -9.295, -75.996, logging.New()).
		WithTicketing(application.NewTicketingService(ticketing)).
		WithAuth(service, tokens).
		WithClosureHour(18).
		App()
	return &authFixture{app: app, ticketing: ticketing, tokens: tokens, userID: userID, tenantID: tenantID, email: "operador@example.com", password: "clave-segura"}
}

func (f *authFixture) token(t *testing.T) string {
	t.Helper()
	token, err := f.tokens.Issue(identity.Claims{UserID: f.userID, TenantID: f.tenantID, Role: identity.RoleManager, ExpiresAt: time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func (f *authFixture) do(method, path, body, token string) *http.Response {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := f.app.Test(req, -1)
	if err != nil {
		panic(err)
	}
	return res
}

func decodeBody(t *testing.T, res *http.Response) string {
	t.Helper()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func TestLoginReturnsUserTenantAndSites(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodPost, "/api/v1/auth/login", `{"email":"`+f.email+`","password":"`+f.password+`"}`, "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	body := decodeBody(t, res)
	if !strings.Contains(body, "access_token") || !strings.Contains(body, "Operador turístico") || !strings.Contains(body, "closure_hour") {
		t.Fatalf("session response is incomplete: %s", body)
	}
	if len(res.Cookies()) == 0 || res.Cookies()[0].Name != refreshCookieName {
		t.Fatal("login must issue an HttpOnly refresh cookie")
	}
}

func TestRefreshRebuildsTheSessionFromCookie(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	login := f.do(http.MethodPost, "/api/v1/auth/login", `{"email":"`+f.email+`","password":"`+f.password+`"}`, "")
	if login.StatusCode != http.StatusOK || len(login.Cookies()) == 0 {
		t.Fatalf("login did not issue refresh cookie: %d", login.StatusCode)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", nil)
	refreshCookie := login.Cookies()[0]
	if claims, parseErr := f.tokens.Parse(refreshCookie.Value); parseErr != nil || claims.Purpose != authadapter.PurposeRefresh {
		t.Fatalf("issued cookie is not a refresh token: value=%q claims=%+v err=%v", refreshCookie.Value, claims, parseErr)
	}
	req.AddCookie(refreshCookie)
	res, err := f.app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK || !strings.Contains(decodeBody(t, res), "access_token") {
		t.Fatalf("want refreshed session, got %d", res.StatusCode)
	}
}

func TestLogoutClearsTheRefreshCookie(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodPost, "/api/v1/auth/logout", "", f.token(t))
	if res.StatusCode != http.StatusNoContent || len(res.Cookies()) == 0 || res.Cookies()[0].Expires.Unix() != 1 {
		t.Fatalf("logout must clear refresh cookie: status=%d cookies=%v", res.StatusCode, res.Cookies())
	}
}

func TestLoginRejectsWrongPasswordWithoutASession(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodPost, "/api/v1/auth/login", `{"email":"`+f.email+`","password":"nope"}`, "")
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", res.StatusCode)
	}
	if strings.Contains(decodeBody(t, res), "access_token") {
		t.Fatal("a failed login must not return a token")
	}
}

func TestLoginRejectsAnInactiveUser(t *testing.T) {
	f := newAuthFixture(false, identity.RoleManager, true)
	res := f.do(http.MethodPost, "/api/v1/auth/login", `{"email":"`+f.email+`","password":"`+f.password+`"}`, "")
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("want 403, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
}

func TestProtectedRouteRequiresAToken(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites", "", "")
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", res.StatusCode)
	}
}

func TestExpiredTokenIsRejected(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	token, err := f.tokens.Issue(identity.Claims{UserID: f.userID, TenantID: f.tenantID, Role: identity.RoleManager, ExpiresAt: time.Now().Add(-time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	res := f.do(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites", "", token)
	if res.StatusCode != http.StatusUnauthorized || !strings.Contains(decodeBody(t, res), "token_expired") {
		t.Fatalf("want 401 token_expired, got %d", res.StatusCode)
	}
}

func TestTenantPathCannotEscapeTheTokenTenant(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodGet, "/api/v1/tenants/"+uuid.NewString()+"/sites", "", f.token(t))
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404 for another tenant, got %d", res.StatusCode)
	}
}

func TestOperatorCannotCreateSites(t *testing.T) {
	f := newAuthFixture(true, identity.RoleOperator, true)
	token, err := f.tokens.Issue(identity.Claims{UserID: f.userID, TenantID: f.tenantID, Role: identity.RoleOperator, ExpiresAt: time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	res := f.do(http.MethodPost, "/api/v1/tenants/"+f.tenantID.String()+"/sites", `{"name":"Otro","code":"otro","timezone":"America/Lima","latitude":-9,"longitude":-76}`, token)
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("want 403, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
}

func TestManagerCanListItsOwnSites(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites", "", f.token(t))
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", res.StatusCode)
	}
}

func TestScopedForecastRejectsASiteOutsideTheTenant(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, false)
	res := f.do(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites/"+uuid.NewString()+"/weather/forecast", "", f.token(t))
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404 for a site outside the tenant, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
}

func TestScopedForecastUsesOwnedSiteCoordinates(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	provider := &coordinatesWeather{}
	app := New(application.NewRegisterVisitService(memoryVisits{}, noopPublisher{}), application.NewGetPredictionService(missingPredictions{}), provider, -9.295, -75.996, logging.New()).
		WithTicketing(application.NewTicketingService(f.ticketing)).
		WithAuth(application.NewAuthService(identityStub{
			user:       identity.User{ID: f.userID, Email: f.email, Active: true, PasswordHash: "hash:" + f.password},
			membership: identity.Membership{UserID: f.userID, TenantID: f.tenantID, TenantName: "Operador turístico", Role: identity.RoleManager},
		}, f.ticketing, passwordStub{}, f.tokens, time.Hour), f.tokens).
		App()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites/"+uuid.NewString()+"/weather/forecast?days=1", nil)
	req.Header.Set("Authorization", "Bearer "+f.token(t))
	res, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK || provider.latitude != 12.34 || provider.longitude != 56.78 {
		t.Fatalf("scoped forecast must use site coordinates, got status=%v coords=%v,%v", res.StatusCode, provider.latitude, provider.longitude)
	}
}

func TestSellTicketsReturnsCodesAndForwardsTheIdempotencyKey(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	siteID := f.ticketing.sites[0].ID
	path := "/api/v1/tenants/" + f.tenantID.String() + "/sites/" + siteID.String() + "/tickets"
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"quantity":2}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+f.token(t))
	req.Header.Set("Idempotency-Key", "double-click-1")
	res, err := f.app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	if f.ticketing.lastKey != "double-click-1" {
		t.Fatalf("idempotency key was not forwarded: %q", f.ticketing.lastKey)
	}
	if !strings.Contains(decodeBody(t, res), "codes") {
		t.Fatal("sale response must include codes")
	}
}

func TestSellTicketsValidatesQuantityAndLocalDay(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	path := "/api/v1/tenants/" + f.tenantID.String() + "/sites/" + f.ticketing.sites[0].ID.String() + "/tickets"
	for _, body := range []string{`{"quantity":0}`, `{"quantity":101}`, `{"quantity":1,"issued_for":"2020-01-01"}`} {
		res := f.do(http.MethodPost, path, body, f.token(t))
		if res.StatusCode != http.StatusUnprocessableEntity {
			t.Fatalf("body %s: want 422, got %d: %s", body, res.StatusCode, decodeBody(t, res))
		}
	}
}

func TestClosureStatusIsTenantScopedAndReportsProcessing(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	f.ticketing.closure = closures.Status{Closed: true, Tickets: 4, PredictionAvailable: false}
	day := time.Now().In(time.FixedZone("America/Lima", -5*3600)).Format("2006-01-02")
	res := f.do(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites/"+f.ticketing.sites[0].ID.String()+"/closures/"+day, "", f.token(t))
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", res.StatusCode, decodeBody(t, res))
	}
	body := decodeBody(t, res)
	if !strings.Contains(body, `"status":"processing"`) || !strings.Contains(body, `"tickets":4`) {
		t.Fatalf("unexpected closure body: %s", body)
	}
}

func TestMeReturnsTheAuthenticatedIdentity(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodGet, "/api/v1/auth/me", "", f.token(t))
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", res.StatusCode)
	}
	if !strings.Contains(decodeBody(t, res), "Operador turístico") {
		t.Fatal("me must hydrate the tenant")
	}
}

func TestLegacyRoutesAreDisabledByDefault(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodGet, "/api/v1/sites/"+uuid.NewString()+"/weather/forecast", "", f.token(t))
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("legacy routes must stay disabled, got %d", res.StatusCode)
	}
}

func TestCalendarWeekStartsOnMondayAndEndsOnSunday(t *testing.T) {
	location, err := time.LoadLocation("America/Lima")
	if err != nil {
		t.Fatal(err)
	}
	start, end := calendarWeek(time.Date(2026, time.October, 7, 12, 0, 0, 0, location))
	if got, want := start.Format("2006-01-02"), "2026-10-05"; got != want {
		t.Fatalf("week starts %s, want %s", got, want)
	}
	if got, want := end.Format("2006-01-02"), "2026-10-11"; got != want {
		t.Fatalf("week ends %s, want %s", got, want)
	}
}

func TestForecastRejectsAnUnsupportedNumberOfDays(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodGet, "/api/v1/tenants/"+f.tenantID.String()+"/sites/"+f.ticketing.sites[0].ID.String()+"/weather/forecast?days=8", "", f.token(t))
	if res.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("want 422 got %v", res.StatusCode)
	}
}

func TestInvalidJSONOnLoginIsRejected(t *testing.T) {
	f := newAuthFixture(true, identity.RoleManager, true)
	res := f.do(http.MethodPost, "/api/v1/auth/login", `{"email":`, "")
	if res.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("want 422, got %d", res.StatusCode)
	}
}
