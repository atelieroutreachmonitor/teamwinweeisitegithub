import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Upload, X, Loader2, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';

interface AdminTableProps<T> {
  table: string;
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode; editable?: boolean; type?: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'image'; options?: string[]; full?: boolean }[];
  title: string;
  eyebrow?: string;
  emptyFields?: Record<string, unknown>;
  orderBy?: string;
}

export function AdminTable<T extends { id: string }>({
  table, columns, title, eyebrow, emptyFields = {}, orderBy = 'created_at',
}: AdminTableProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [viewing, setViewing] = useState<T | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from(table).select('*').order(orderBy, { ascending: false });
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data as T[]) || []);
      }
    } catch (e) {
      setError(String(e));
      setRows([]);
    }
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => {
    setEditForm({ ...emptyFields });
    setCreating(true);
    setEditing(null);
  };

  const startEdit = (row: T) => {
    setEditForm({ ...row });
    setEditing(row);
    setCreating(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = { ...editForm };
    delete (payload as Record<string, unknown>).created_at;
    delete (payload as Record<string, unknown>).updated_at;

    try {
      if (creating) {
        const { error: err } = await supabase.from(table).insert(payload);
        if (err) {
          setError(err.message);
        } else {
          setCreating(false);
          setEditForm({});
          await load();
        }
      } else if (editing) {
        const { error: err } = await supabase.from(table).update(payload).eq('id', editing.id);
        if (err) {
          setError(err.message);
        } else {
          setEditing(null);
          setEditForm({});
          await load();
        }
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
    const { error: err } = await supabase.from(table).delete().eq('id', id);
    if (err) setError(err.message);
    else await load();
  };

  const closePanel = () => {
    setEditing(null);
    setCreating(false);
    setEditForm({});
    setError(null);
  };

  const uploadImage = async (file: File, field: string) => {
    setUploadingField(field);
    const ext = file.name.split('.').pop();
    const fileName = `${table}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('uploads').upload(fileName, file, { upsert: true });
    if (upErr) {
      setError(upErr.message);
      setUploadingField(null);
      return;
    }
    const { data: pubData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    setEditForm((prev) => ({ ...prev, [field]: pubData.publicUrl }));
    setUploadingField(null);
  };

  const filteredRows = search
    ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
    : rows;

  const editableColumns = columns.filter((c) => c.editable);

  const exportCSV = () => {
    const headers = columns.map((c) => c.label);
    const escapeValue = (val: unknown) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const csvRows = filteredRows.map((row) =>
      columns.map((col) => escapeValue(row[col.key as keyof T])).join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${table}-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          {eyebrow && <p className="font-spartan text-xs uppercase tracking-wider text-gold-500 font-semibold mb-1">{eyebrow}</p>}
          <h2 className="font-playfair text-2xl font-bold text-plum-700">{title}</h2>
          <p className="font-spartan text-sm text-charcoal-500 mt-1">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-xl border border-plum-200 bg-white font-spartan text-sm focus:outline-none focus:border-plum-500 w-40 sm:w-56"
          />
          <button onClick={load} className="px-3 py-2 bg-cream-50 hover:bg-plum-50 text-plum-600 rounded-xl transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCSV} className="px-4 py-2 bg-cream-50 hover:bg-plum-50 text-plum-600 font-spartan text-sm font-semibold rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5" title="Export to CSV">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={startCreate} className="px-4 py-2 bg-plum-600 hover:bg-plum-700 text-white font-spartan text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
            + Add New
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="font-spartan text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="text-plum-500" /></div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-plum-100 p-12 text-center">
          <p className="font-spartan text-charcoal-500">No items found. Click "Add New" to create one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-plum-100 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-plum-50 border-b border-plum-100">
                {columns.map((col) => (
                  <th key={String(col.key)} className="text-left px-4 py-3 font-spartan text-xs font-semibold uppercase tracking-wider text-plum-600 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-spartan text-xs font-semibold uppercase tracking-wider text-plum-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-plum-50 hover:bg-cream-50/50 transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 font-spartan text-sm text-charcoal-700">
                      {col.render ? col.render(row) : formatCell(row[col.key as keyof T], col.type)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setViewing(row)} className="font-spartan text-xs font-semibold text-plum-600 hover:text-plum-700 mr-3">View</button>
                    <button onClick={() => startEdit(row)} className="font-spartan text-xs font-semibold text-plum-600 hover:text-plum-700 mr-3">Edit</button>
                    <button onClick={() => remove(row.id)} className="font-spartan text-xs font-semibold text-red-500 hover:text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Panel */}
      {viewing && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-plum-950/60 animate-fade-in" onClick={() => setViewing(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-plum-700">View — {title}</h3>
              <button onClick={() => setViewing(null)} className="p-2 text-charcoal-400 hover:bg-plum-50 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {columns.map((col) => {
                const value = viewing[col.key as keyof T];
                return (
                  <div key={String(col.key)} className={col.full ? 'col-span-2' : ''}>
                    <label className="block font-spartan text-sm font-medium text-charcoal-700 mb-1.5">{col.label}</label>
                    {col.type === 'image' ? (
                      value ? (
                        <div className="w-full h-40 rounded-xl overflow-hidden border border-plum-200">
                          <img src={String(value)} alt={col.label} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <p className="font-spartan text-sm text-charcoal-400">—</p>
                      )
                    ) : col.type === 'boolean' ? (
                      <p className="font-spartan text-sm text-charcoal-800">{value ? 'Yes' : 'No'}</p>
                    ) : (String(col.key) === 'created_at' || String(col.key) === 'updated_at') && value ? (
                      <p className="font-spartan text-sm text-charcoal-800">
                        {new Date(String(value)).toLocaleString()}
                      </p>
                    ) : (
                      <p className="font-spartan text-sm text-charcoal-800 break-words">
                        {value === null || value === undefined ? '—' : String(value)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setViewing(null)} className="px-5 py-2.5 rounded-lg font-spartan text-sm font-semibold text-charcoal-600 hover:bg-plum-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Panel */}
      {(editing || creating) && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-plum-950/60 animate-fade-in" onClick={closePanel} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-plum-700">
                {creating ? 'Create New' : 'Edit'} — {title}
              </h3>
              <button onClick={closePanel} className="p-2 text-charcoal-400 hover:bg-plum-50 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="font-spartan text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {editableColumns.map((col) => (
                <div key={String(col.key)} className={col.full ? 'col-span-2' : ''}>
                  <label className="block font-spartan text-sm font-medium text-charcoal-700 mb-1.5">{col.label}</label>
                  {col.type === 'image' ? (
                    <ImageUpload
                      value={String(editForm[col.key as string] ?? '')}
                      onChange={(url) => setEditForm({ ...editForm, [col.key as string]: url })}
                      onUpload={(file) => uploadImage(file, String(col.key))}
                      uploading={uploadingField === String(col.key)}
                    />
                  ) : col.type === 'textarea' ? (
                    <textarea
                      value={String(editForm[col.key as string] ?? '')}
                      onChange={(e) => setEditForm({ ...editForm, [col.key as string]: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-plum-200 bg-cream-50 font-spartan text-sm text-charcoal-800 focus:outline-none focus:border-plum-500 resize-none"
                    />
                  ) : col.type === 'boolean' ? (
                    <select
                      value={editForm[col.key as string] ? 'true' : 'false'}
                      onChange={(e) => setEditForm({ ...editForm, [col.key as string]: e.target.value === 'true' })}
                      className="w-full px-4 py-2.5 rounded-xl border border-plum-200 bg-cream-50 font-spartan text-sm text-charcoal-800 focus:outline-none focus:border-plum-500"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : col.type === 'select' && col.options ? (
                    <select
                      value={String(editForm[col.key as string] ?? '')}
                      onChange={(e) => setEditForm({ ...editForm, [col.key as string]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-plum-200 bg-cream-50 font-spartan text-sm text-charcoal-800 focus:outline-none focus:border-plum-500"
                    >
                      <option value="">Select...</option>
                      {col.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={col.type === 'number' ? 'number' : 'text'}
                      value={String(editForm[col.key as string] ?? '')}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        [col.key as string]: col.type === 'number' ? Number(e.target.value) : e.target.value,
                      })}
                      className="w-full px-4 py-2.5 rounded-xl border border-plum-200 bg-cream-50 font-spartan text-sm text-charcoal-800 focus:outline-none focus:border-plum-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closePanel} className="px-5 py-2.5 rounded-lg font-spartan text-sm font-semibold text-charcoal-600 hover:bg-plum-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-lg font-spartan text-sm font-semibold bg-plum-600 hover:bg-plum-700 text-white transition-colors disabled:opacity-60">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageUpload({ value, onChange, onUpload, uploading }: {
  value: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-3">
      {value && (
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-plum-200">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 p-1.5 bg-plum-950/60 text-white rounded-lg hover:bg-plum-950/80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-plum-200 rounded-xl cursor-pointer hover:border-plum-400 transition-colors font-spartan text-sm text-charcoal-600">
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload from Computer
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
      <input
        type="text"
        placeholder="Or paste image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-plum-200 bg-cream-50 font-spartan text-sm text-charcoal-800 focus:outline-none focus:border-plum-500"
      />
    </div>
  );
}

function formatCell(value: unknown, type?: string): string {
  if (value === null || value === undefined) return '—';
  if (type === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toLocaleDateString();
  }
  const str = String(value);
  return str.length > 60 ? str.slice(0, 60) + '...' : str;
}
