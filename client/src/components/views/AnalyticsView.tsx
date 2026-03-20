import { BarChart3 } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';

export function AnalyticsView() {
  const { data, isLoading } = useAnalytics(true);
  if (isLoading) return <div className="p-6">Betöltés...</div>;
  if (!data) return <div className="p-6">Nincs adat</div>;

  const maxBar = Math.max(...data.dailyVolume.map((d) => d.count), 1);
  const totalCat = data.categories.reduce((s, c) => s + c.count, 0) || 1;

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <h1 className="dark:text-dark-text flex items-center gap-2 text-xl font-semibold">
        <BarChart3 className="h-5 w-5" />
        Statisztikák
      </h1>

      <section className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Email volumen (30 nap)</h2>
        <div className="flex h-28 min-w-[640px] items-end gap-1">
          {data.dailyVolume.map((d) => (
            <div
              key={d.day}
              className="flex-1 rounded-t bg-blue-500/70"
              style={{ height: `${(d.count / maxBar) * 100}%` }}
              title={`${d.day}: ${d.count}`}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-2">
        <div className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border p-4">
          <h3 className="font-medium">Átlagos válaszidő</h3>
          <p className="mt-2 text-2xl font-semibold">{data.avgResponseHours} óra</p>
        </div>
        <div className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border p-4">
          <h3 className="font-medium">Heti összehasonlítás</h3>
          <p className="mt-2">
            Ez a hét: <strong>{data.weeklyComparison.current}</strong>
          </p>
          <p>
            Múlt hét: <strong>{data.weeklyComparison.previous}</strong>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-2">
        <div className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border p-4">
          <h3 className="mb-2 font-medium">Top 10 küldő</h3>
          <ul className="space-y-1 text-sm">
            {data.topSenders.map((s) => (
              <li key={s.email}>
                {s.name} — {s.count}
              </li>
            ))}
          </ul>
        </div>
        <div className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border p-4">
          <h3 className="mb-2 font-medium">Kategória megoszlás</h3>
          <div className="space-y-1 text-sm">
            {data.categories.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between">
                  <span>{c.name}</span>
                  <span>{Math.round((c.count / totalCat) * 100)}%</span>
                </div>
                <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded bg-purple-500"
                    style={{ width: `${(c.count / totalCat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
