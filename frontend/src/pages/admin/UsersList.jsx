import React, { useEffect, useMemo, useState } from 'react';
import { adminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import Table from '../../components/Table';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import FormInput from '../../components/FormInput';
import Alert from '../../components/Alert';
import { LoadingState } from '../../components/Spinner';

const roleOptions = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'ASESOR', label: 'Asesor' },
  { value: 'ADMIN', label: 'Administrador' },
];

export default function UsersList() {
  const { user: sessionUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [accessForm, setAccessForm] = useState({ rol: 'CLIENTE', activo: true });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getUsers();
      if (response.success) setUsers(response.data.users || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el directorio de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((account) => {
      const matchesSearch = !query || [account.nombre, account.email, account.cedula]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
      const matchesRole = roleFilter === 'TODOS' || account.rol === roleFilter;
      const matchesStatus = statusFilter === 'TODOS'
        || (statusFilter === 'ACTIVOS' ? account.activo : !account.activo);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const openAccessModal = (account) => {
    setSelectedUser(account);
    setAccessForm({ rol: account.rol, activo: Boolean(account.activo) });
    setError(null);
  };

  const closeAccessModal = () => {
    if (!saving) setSelectedUser(null);
  };

  const saveAccess = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await adminService.updateUserAccess(selectedUser.id, accessForm);
      if (response.success) {
        const updatedUser = response.data.user;
        setUsers((current) => current.map((account) => (
          account.id === updatedUser.id ? updatedUser : account
        )));
        setSelectedUser(null);
        setSuccess(`Acceso de ${updatedUser.nombre} actualizado correctamente.`);
      }
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el acceso del usuario.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Cargando directorio de usuarios..." />;

  const headers = [
    'Nombre y apellidos',
    'Correo electrónico',
    'Rol',
    'Cédula',
    'Teléfono',
    'Fecha de registro',
    'Estado',
    ...(isAdmin ? ['Acciones'] : []),
  ];

  return (
    <div className="space-y-space-md max-w-[1440px] mx-auto">
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="alert" iconName="group">Control de accesos</Badge>
          </div>
          <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-primary font-bold">
            Directorio institucional de usuarios
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
            {isAdmin
              ? 'Asigna roles y administra el acceso de clientes, asesores y administradores.'
              : 'Consulta las cuentas registradas y su estado dentro de la institución.'}
          </p>
        </div>
      </div>

      {error && !selectedUser && <Alert type="error" title="Error">{error}</Alert>}
      {success && <Alert type="success" title="Acceso actualizado">{success}</Alert>}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormInput
            label="Buscar usuario"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, correo o cédula"
          />
          <FormInput
            type="select"
            label="Rol"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            options={[{ value: 'TODOS', label: 'Todos los roles' }, ...roleOptions]}
          />
          <FormInput
            type="select"
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { value: 'TODOS', label: 'Todos los estados' },
              { value: 'ACTIVOS', label: 'Activos' },
              { value: 'INACTIVOS', label: 'Inactivos' },
            ]}
          />
        </div>
      </Card>

      <Card title={`Usuarios registrados (${filteredUsers.length})`}>
        <Table headers={headers}>
          {filteredUsers.map((account) => (
            <tr key={account.id} className="hover:bg-surface-container-low/40 transition-colors">
              <td className="py-3 px-4 font-bold text-primary font-body-sm text-[13px]">
                {account.nombre}
                {account.id === sessionUser?.id && (
                  <span className="block text-[11px] font-normal text-secondary mt-0.5">Tu cuenta</span>
                )}
              </td>
              <td className="py-3 px-4 text-on-surface-variant font-body-sm text-[13px]">{account.email}</td>
              <td className="py-3 px-4">
                <Badge variant={account.rol === 'ADMIN' ? 'alert' : account.rol === 'ASESOR' ? 'bce' : 'seps'} size="sm">
                  {account.rol}
                </Badge>
              </td>
              <td className="py-3 px-4 font-numeric-data text-[13px] text-primary font-semibold">
                {account.cedula || '—'}
              </td>
              <td className="py-3 px-4 font-numeric-data text-[12px] text-on-surface-variant">
                {account.telefono || '—'}
              </td>
              <td className="py-3 px-4 font-numeric-data text-[12px] text-on-surface-variant">
                {new Date(account.createdAt).toLocaleDateString('es-EC')}
              </td>
              <td className="py-3 px-4">
                <Badge variant={account.activo ? 'seps' : 'alert'} size="sm">
                  {account.activo ? 'Activo' : 'Bloqueado'}
                </Badge>
              </td>
              {isAdmin && (
                <td className="py-3 px-4">
                  <Button size="sm" variant="outline" iconName="manage_accounts" onClick={() => openAccessModal(account)}>
                    Gestionar
                  </Button>
                </td>
              )}
            </tr>
          ))}
          {filteredUsers.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="py-8 px-4 text-center text-on-surface-variant text-[13px]">
                No hay usuarios que coincidan con los filtros seleccionados.
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <Modal
        isOpen={Boolean(selectedUser)}
        onClose={closeAccessModal}
        title={`Gestionar acceso: ${selectedUser?.nombre || ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={saveAccess} className="space-y-4">
          {error && <Alert type="error" title="No se pudo actualizar">{error}</Alert>}

          {selectedUser?.id === sessionUser?.id && (
            <Alert type="warning" title="Cuenta actual">
              Por seguridad no puedes quitarte el rol de administrador ni bloquear tu propia cuenta.
            </Alert>
          )}

          <div className="rounded-lg bg-surface-container-low border border-surface-container-high p-3 text-[13px]">
            <strong className="block text-primary">{selectedUser?.email}</strong>
            <span className="text-on-surface-variant">Cédula: {selectedUser?.cedula || 'No registrada'}</span>
          </div>

          <FormInput
            type="select"
            label="Rol del sistema"
            name="rol"
            value={accessForm.rol}
            onChange={(event) => setAccessForm((current) => ({ ...current, rol: event.target.value }))}
            options={roleOptions}
            disabled={selectedUser?.id === sessionUser?.id}
            required
          />

          <label className="flex items-start gap-3 rounded-lg border border-surface-container-high p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accessForm.activo}
              disabled={selectedUser?.id === sessionUser?.id}
              onChange={(event) => setAccessForm((current) => ({ ...current, activo: event.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-secondary"
            />
            <span>
              <strong className="block text-[13px] text-primary">Cuenta activa</strong>
              <span className="text-[12px] text-on-surface-variant">
                Una cuenta bloqueada no podrá iniciar sesión ni usar un token existente.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-container-high">
            <Button variant="ghost" onClick={closeAccessModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="fintech" loading={saving} loadingText="Guardando..." iconName="save">
              Guardar acceso
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
