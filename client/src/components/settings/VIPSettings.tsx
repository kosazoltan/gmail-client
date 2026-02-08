import { useState } from 'react';
import { Crown, Plus, Trash2, Loader2, User } from 'lucide-react';
import { useVipSenders, useAddVip, useDeleteVip } from '../../hooks/useVip';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

export function VIPSettings() {
  const { data: vipSenders, isLoading } = useVipSenders();
  const addVip = useAddVip();
  const deleteVip = useDeleteVip();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newEmail.trim()) {
      toast.error('Kérlek add meg az email címet');
      return;
    }

    addVip.mutate(
      { email: newEmail.trim(), name: newName.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('VIP küldő hozzáadva');
          setNewEmail('');
          setNewName('');
          setShowAddForm(false);
        },
        onError: (error) => {
          toast.error(error.message || 'Nem sikerült hozzáadni');
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteVip.mutate(id, {
      onSuccess: () => {
        toast.success('VIP küldő eltávolítva');
        setConfirmDeleteId(null);
      },
      onError: () => {
        toast.error('Nem sikerült törölni');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="dark:text-dark-text mb-1 text-lg font-medium text-gray-800">VIP küldők</h3>
        <p className="dark:text-dark-text-muted mb-4 text-sm text-gray-500">
          A VIP küldőktől érkező levelek koronával lesznek jelölve, és mindig megkapod róluk az
          értesítést (még csendes órákban is).
        </p>
      </div>

      {/* Add button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-[#4f6ef7] transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
        >
          <Plus className="h-4 w-4" />
          VIP küldő hozzáadása
        </button>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="dark:bg-dark-bg space-y-3 rounded-lg bg-gray-50 p-4">
          <div>
            <label className="dark:text-dark-text-muted mb-1 block text-sm text-gray-500">
              Email cím *
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="vip@example.com"
              className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
              autoFocus
            />
          </div>
          <div>
            <label className="dark:text-dark-text-muted mb-1 block text-sm text-gray-500">
              Név (opcionális)
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Példa Béla"
              className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addVip.isPending || !newEmail.trim()}
              className="flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
            >
              {addVip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Hozzáadás
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewEmail('');
                setNewName('');
              }}
              className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200"
            >
              Mégsem
            </button>
          </div>
        </div>
      )}

      {/* VIP list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : vipSenders && vipSenders.length > 0 ? (
        <div className="space-y-2">
          {vipSenders.map((vip) => (
            <div
              key={vip.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3',
                confirmDeleteId === vip.id
                  ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-500/10'
                  : 'dark:border-dark-border dark:bg-dark-bg-secondary border-gray-200 bg-white',
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                  <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="dark:text-dark-text font-medium text-gray-800">
                    {vip.name || vip.email}
                  </div>
                  {vip.name && (
                    <div className="dark:text-dark-text-muted text-sm text-gray-500">
                      {vip.email}
                    </div>
                  )}
                </div>
              </div>

              {confirmDeleteId === vip.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(vip.id)}
                    disabled={deleteVip.isPending}
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteVip.isPending ? 'Törlés...' : 'Igen'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="dark:text-dark-text-secondary dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg rounded bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
                  >
                    Nem
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(vip.id)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  title="Eltávolítás"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="dark:text-dark-text-muted py-8 text-center text-gray-400">
          <User className="mx-auto mb-2 h-12 w-12 opacity-50" />
          <p>Még nincsenek VIP küldők</p>
        </div>
      )}

      <div className="dark:text-dark-text-muted dark:border-dark-border border-t border-gray-100 pt-2 text-xs text-gray-400">
        Tipp: A levél részleteinél is hozzáadhatsz bárkit VIP-nek a korona ikonra kattintva.
      </div>
    </div>
  );
}
