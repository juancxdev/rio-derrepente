import { SignOut } from '@phosphor-icons/react';
import { useTenant } from '../tenant/TenantContext';
import type { Role } from '../types';

const roleLabel: Record<Role, string> = {
  operator: 'Operador',
  manager: 'Encargado',
  admin: 'Administrador',
  super_admin: 'Super administrador',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu() {
  const { user, role, logout } = useTenant();
  if (!user) return null;
  return (
    <div className="user-menu">
      <div className="user-menu__identity">
        <span className="user-menu__avatar" aria-hidden="true">{initials(user.display_name) || 'OP'}</span>
        <span className="user-menu__text">
          <span>{user.email}</span>
          <em>{role ? roleLabel[role] : 'Sin rol'}</em>
        </span>
      </div>
      <button type="button" className="user-menu__logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}>
        <SignOut size={18} weight="bold" aria-hidden="true" />
        <span className="nav-label">Cerrar sesión</span>
      </button>
    </div>
  );
}
