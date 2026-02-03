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
        <h3 className="text-lg font-medium text-gray-800 dark:text-dark-text mb-1">
          VIP küldők
        </h3>
        <p className="text-sm text-gray-500 dark:text-dark-text-muted mb-4">
          A VIP küldőktől érkező levelek koronával lesznek jelölve, és mindig megkapod róluk az értesítést (még csendes órákban is).
        </p>
      </div>

      {/* Add button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          VIP küldő hozzáadása
        </button>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 dark:bg-dark-bg rounded-lg space-y-3">
          <div>
            <label className="block text-sm text-gray-500 dark:text-dark-text-muted mb-1">
              Email cím *
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="vip@example.com"
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg-secondary text-gray-800 dark:text-dark-text text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-dark-text-muted mb-1">
              Név (opcionális)
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Példa Béla"
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg-secondary text-gray-800 dark:text-dark-text text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addVip.isPending || !newEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
              className="px-4 py-2 text-sm text-gray-600 dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
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
                'flex items-center justify-between p-3 rounded-lg border',
                confirmDeleteId === vip.id
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/10'
                  : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg-secondary',
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">
                    {vip.name || vip.email}
                  </div>
                  {vip.name && (
                    <div className="text-sm text-gray-500 dark:text-dark-text-muted">
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
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteVip.isPending ? 'Törlés...' : 'Igen'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-3 py-1 text-sm text-gray-600 dark:text-dark-text-secondary bg-gray-100 dark:bg-dark-bg-tertiary rounded hover:bg-gray-200 dark:hover:bg-dark-bg"
                  >
                    Nem
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(vip.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Eltávolítás"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 dark:text-dark-text-muted">
          <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Még nincsenek VIP küldők</p>
        </div>
      )}

      <div className="text-xs text-gray-400 dark:text-dark-text-muted pt-2 border-t border-gray-100 dark:border-dark-border">
        Tipp: A levél részleteinél is hozzáadhatsz bárkit VIP-nek a korona ikonra kattintva.
      </div>
    </div>
  );
}
