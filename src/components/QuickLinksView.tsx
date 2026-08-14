import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, ExternalLink } from 'lucide-react';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { QuickLink } from '../types';

const BUILTIN_LINKS = [
  { title: 'IITD Webmail', url: 'https://webmail.iitd.ac.in/', icon: '📧', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  { title: 'eAcademics', url: 'https://eacademics.iitd.ac.in/', icon: '🎓', color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
  { title: 'Student Corner', url: 'https://ecampus.iitd.ac.in/scorner/login', icon: '🏫', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  { title: 'KSBS Hood Booking', url: 'https://scfbio.iitd.ac.in/ksbs-booking-system/index.html', icon: '🔬', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
];

export const QuickLinksView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { showToast } = useUI();
  const [customLinks, setCustomLinks] = useState<QuickLink[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.fetchQuickLinks().then(setCustomLinks);
  }, []);

  const handleAdd = async () => {
    if (!title.trim() || !url.trim() || !currentUser) return;
    setSaving(true);
    try {
      let finalUrl = url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
      const link = await api.addQuickLink(title.trim(), finalUrl, currentUser.id);
      setCustomLinks((prev) => [...prev, link]);
      setTitle('');
      setUrl('');
      setShowAdd(false);
      showToast('Link added!', 'success');
    } catch {
      showToast('Could not add link.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.removeQuickLink(id);
      setCustomLinks((prev) => prev.filter((l) => l.id !== id));
      showToast('Link removed.', 'success');
    } catch {
      showToast('Could not remove link.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-28 pt-4 max-w-md mx-auto w-full px-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-xl font-bold text-white mb-1">Quick Links</h1>
      <p className="text-sm text-gray-400 mb-5">IITD portals & custom links</p>

      <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">IITD Portals</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {BUILTIN_LINKS.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4 hover:border-primary/40 transition-colors group flex flex-col items-center text-center gap-2"
          >
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl ${link.color}`}>
              {link.icon}
            </div>
            <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
              {link.title}
            </span>
            <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
          </a>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Custom Links</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-primary hover:text-orange-400 transition-colors flex items-center gap-1 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Link
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#1E1E1E] border border-primary/30 rounded-xl p-4 mb-4 space-y-3">
          <input
            className="w-full px-3 py-2 bg-background border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Title (e.g. Lab Wiki)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 bg-background border border-[#2A2A2A] rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="URL (e.g. wiki.example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !title.trim() || !url.trim()}
              className="flex-1 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setTitle(''); setUrl(''); }}
              className="px-4 py-2 bg-[#2A2A2A] text-gray-300 rounded-md text-sm font-medium hover:bg-[#333] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {customLinks.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#2A2A2A] rounded-xl bg-[#1E1E1E]">
          <span className="material-symbols-outlined text-gray-600 text-3xl mb-2">link</span>
          <p className="text-sm text-gray-400">No custom links yet</p>
          <p className="text-xs text-gray-500 mt-1">Add useful links for your lab</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {customLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 hover:border-primary/30 transition-colors group flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px]">link</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">
                  {link.title}
                </p>
                <p className="text-[11px] text-gray-500 truncate">{link.url}</p>
              </div>
              {currentUser && link.addedBy?.id === currentUser.id && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(link.id); }}
                  className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
