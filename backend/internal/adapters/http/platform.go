package httpadapter

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/juancx/tourism-platform/backend/internal/domain/identity"
)

func (a *API) requirePlatform() error {
	if a.platform == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "platform service unavailable")
	}
	return nil
}

func (a *API) listPlatformTenants(c *fiber.Ctx) error {
	if err := a.requirePlatform(); err != nil {
		return err
	}
	items, err := a.platform.ListTenants(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(items)
}

func (a *API) createPlatformTenant(c *fiber.Ctx) error {
	if err := a.requirePlatform(); err != nil {
		return err
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid JSON")
	}
	tenant, err := a.platform.CreateTenant(c.Context(), req.Name)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(tenant)
}

func (a *API) listPlatformSites(c *fiber.Ctx) error {
	if err := a.requirePlatform(); err != nil {
		return err
	}
	tenantID, err := uuid.Parse(c.Params("tenantID"))
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid tenant_id")
	}
	items, err := a.platform.ListSites(c.Context(), tenantID)
	if err != nil {
		return err
	}
	return c.JSON(items)
}

func (a *API) createPlatformSite(c *fiber.Ctx) error {
	if err := a.requirePlatform(); err != nil {
		return err
	}
	tenantID, err := uuid.Parse(c.Params("tenantID"))
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid tenant_id")
	}
	var req struct {
		Code      string  `json:"code"`
		Name      string  `json:"name"`
		Timezone  string  `json:"timezone"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid JSON")
	}
	site, err := a.platform.CreateSite(c.Context(), tenantID, req.Code, req.Name, req.Latitude, req.Longitude, req.Timezone)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(site)
}

func (a *API) listPlatformUsers(c *fiber.Ctx) error {
	if err := a.requirePlatform(); err != nil {
		return err
	}
	items, err := a.platform.ListAccounts(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(items)
}

func (a *API) createPlatformUser(c *fiber.Ctx) error {
	if err := a.requirePlatform(); err != nil {
		return err
	}
	var req struct {
		Email       string `json:"email"`
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
		TenantID    string `json:"tenant_id"`
		Role        string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid JSON")
	}
	tenantID, err := uuid.Parse(strings.TrimSpace(req.TenantID))
	if err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "invalid tenant_id")
	}
	role := identity.Role(strings.ToLower(strings.TrimSpace(req.Role)))
	if !role.ValidTenantRole() {
		return fiber.NewError(fiber.StatusUnprocessableEntity, "role must be operator, manager or admin")
	}
	account, err := a.platform.CreateAccount(c.Context(), req.Email, req.DisplayName, req.Password, tenantID, role)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(account)
}
