import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Wrench,
  AlertTriangle,
  Phone,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Equipment, EquipmentIssue, EquipmentStatus, IssueStatus } from '../types';
import { equipmentIconSvg, equipmentLabel, EquipmentCategory } from '../lib/equipmentIcons';
import { avatarClasses } from '../lib/accent';
import { initialOf, timeAgo } from '../lib/format';
import { ConfirmModal } from './ConfirmModal';

const STATUS_OPTIONS: { value: EquipmentStatus; label: string; color: string }[] = [
  { value: 'working', label: 'Working', color: 'text-emerald-300' },
  { value: 'needs_attention', label: 'Needs Attention', color: 'text-amber-300' },
  { value: 'down', label: 'Down', color: 'text-red-300' },
  { value: 'under_service', label: 'Under Service', color: 'text-blue-300' },
];

const ISSUE_STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'reported', label: 'Reported' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'vendor_called', label: 'Vendor Called' },
  { value: 'fixed', label: 'Fixed' },
];

interface Props {
  equipment: Equipment;
  onClose: () => void;
}

export const EquipmentThreadModal: React.FC<Props> = ({ equipment: eq, onClose }) => {
  const {
    editEquipment,
    removeEquipment,
    reportIssue,
    updateIssueStatus,
    addIssueResponse,
    addMaintenanceLog,
  } = useApp();
  const { currentUser } = useAuth();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [postingResponse, setPostingResponse] = useState(false);

  // Report issue form
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');

  // Maintenance form
  const [maintDesc, setMaintDesc] = useState('');
  const [maintBy, setMaintBy] = useState('');
  const [maintCost, setMaintCost] = useState('');
  const [maintDate, setMaintDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintNextDue, setMaintNextDue] = useState('');

  // Fix form
  const [fixingIssueId, setFixingIssueId] = useState<string | null>(null);
  const [fixSummary, setFixSummary] = useState('');
  const [fixedBy, setFixedBy] = useState('');
  const [fixCost, setFixCost] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteConfirm && !showReportIssue && !showAddMaintenance && !fixingIssueId) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showDeleteConfirm, showReportIssue, showAddMaintenance, fixingIssueId]);

  const isAdmin = currentUser?.role !== 'lab_member';
  const openIssues = eq.issues.filter((i) => i.status !== 'fixed');
  const fixedIssues = eq.issues.filter((i) => i.status === 'fixed');
  const warrantyActive = eq.warrantyExpiry && new Date(eq.warrantyExpiry) > new Date();

  const handleStatusChange = async (status: EquipmentStatus) => {
    await editEquipment(eq.id, { status });
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    await reportIssue(eq.id, { title: issueTitle.trim(), description: issueDesc.trim() });
    setIssueTitle('');
    setIssueDesc('');
    setShowReportIssue(false);
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintDesc.trim()) return;
    await addMaintenanceLog(eq.id, {
      description: maintDesc.trim(),
      performedBy: maintBy.trim(),
      cost: maintCost ? parseFloat(maintCost) : undefined,
      serviceDate: maintDate,
      nextDueDate: maintNextDue || undefined,
    });
    setMaintDesc('');
    setMaintBy('');
    setMaintCost('');
    setMaintNextDue('');
    setShowAddMaintenance(false);
  };

  const handlePostResponse = async (issueId: string) => {
    if (!responseText.trim() || postingResponse) return;
    setPostingResponse(true);
    try {
      await addIssueResponse(issueId, responseText.trim());
      setResponseText('');
    } finally {
      setPostingResponse(false);
    }
  };

  const handleMarkFixed = async () => {
    if (!fixingIssueId) return;
    await updateIssueStatus(
      fixingIssueId,
      'fixed',
      fixSummary.trim(),
      fixedBy.trim(),
      fixCost ? parseFloat(fixCost) : undefined
    );
    setFixingIssueId(null);
    setFixSummary('');
    setFixedBy('');
    setFixCost('');
  };

  const renderIssue = (issue: EquipmentIssue) => {
    const isExpanded = expandedIssue === issue.id;
    const statusColor = issue.status === 'fixed' ? 'text-emerald-400' : issue.status === 'reported' ? 'text-red-400' : 'text-amber-400';

    return (
      <div key={issue.id} className="bg-[#1E1E1E] rounded-xl border border-[#2A2A2A] overflow-hidden">
        <button
          onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
          className="w-full text-left p-3.5 flex items-start gap-3"
        >
          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${statusColor}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{issue.title}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
              <span className={`font-semibold uppercase ${statusColor}`}>{issue.status.replace('_', ' ')}</span>
              <span>·</span>
              <span>{issue.reportedBy?.name ?? 'Unknown'}</span>
              <span>·</span>
              <span>{timeAgo(issue.createdAt)}</span>
            </div>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
        </button>

        {isExpanded && (
          <div className="px-3.5 pb-3.5 space-y-3 border-t border-[#2A2A2A] pt-3">
            {issue.description && (
              <p className="text-xs text-gray-400 bg-background p-2.5 rounded-lg border border-[#2A2A2A]">{issue.description}</p>
            )}

            {issue.fixSummary && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 space-y-1">
                <p className="text-[11px] font-bold text-emerald-300 uppercase">Fix</p>
                <p className="text-xs text-gray-300">{issue.fixSummary}</p>
                {issue.fixedBy && <p className="text-[11px] text-gray-500">Fixed by: {issue.fixedBy}</p>}
                {issue.fixCost != null && <p className="text-[11px] text-gray-500">Cost: ₹{issue.fixCost.toLocaleString('en-IN')}</p>}
              </div>
            )}

            {/* Responses / ideas thread */}
            {issue.responses.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-500 uppercase">Ideas & Updates ({issue.responses.length})</p>
                {issue.responses.map((r) => (
                  <div key={r.id} className="flex gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0 ${avatarClasses(r.author?.accent)}`}>
                      {initialOf(r.author?.name ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-bold text-white">{r.author?.name ?? 'Someone'}</span>
                        <span className="text-[10px] text-gray-600">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{r.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {issue.status !== 'fixed' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Share an idea or update..."
                  value={expandedIssue === issue.id ? responseText : ''}
                  onChange={(e) => setResponseText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handlePostResponse(issue.id);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-full bg-background border border-[#2A2A2A] text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-gray-600"
                />
                <button
                  onClick={() => void handlePostResponse(issue.id)}
                  disabled={!responseText.trim() || postingResponse}
                  className="p-1.5 rounded-full bg-primary text-white disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Action buttons */}
            {issue.status !== 'fixed' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {ISSUE_STATUS_OPTIONS.filter((o) => o.value !== 'fixed' && o.value !== issue.status).map((o) => (
                  <button
                    key={o.value}
                    onClick={() => void updateIssueStatus(issue.id, o.value)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#2A2A2A] text-gray-300 hover:bg-[#333] border border-[#333] transition-colors"
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setFixingIssueId(issue.id);
                    setFixSummary('');
                    setFixedBy('');
                    setFixCost('');
                  }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Mark Fixed
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex justify-center"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="w-full max-w-md h-full bg-background flex flex-col overflow-hidden sm:rounded-xl sm:my-4 sm:h-[94vh] shadow-2xl border border-[#2A2A2A]"
        >
          {/* Header */}
          <div className="safe-top-modal px-4 pb-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1E1E1E] sticky top-0 z-20">
            <button onClick={onClose} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#2A2A2A] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Equipment</span>
            {isAdmin ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-6" />
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
            {/* Equipment info card */}
            <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#2A2A2A] space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-lg bg-[#2A2A2A] border border-[#333] flex items-center justify-center text-gray-400 shrink-0"
                  dangerouslySetInnerHTML={{ __html: equipmentIconSvg(eq.category as EquipmentCategory) }}
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-extrabold text-white">{eq.name}</h1>
                  {eq.model && (
                    <p className="text-xs text-gray-400">
                      {eq.manufacturer && <span className="font-semibold text-gray-300">{eq.manufacturer}</span>}
                      {eq.manufacturer && eq.model && ' · '}
                      {eq.model}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-0.5">{equipmentLabel(eq.category as EquipmentCategory)}</p>
                </div>
              </div>

              {/* Status selector */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => void handleStatusChange(s.value)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      eq.status === s.value
                        ? `${s.color} bg-white/5 border-current`
                        : 'text-gray-500 border-[#333] hover:border-gray-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {eq.location && (
                  <div className="bg-background p-2 rounded-lg border border-[#2A2A2A]">
                    <p className="text-gray-600 font-bold uppercase text-[10px]">Location</p>
                    <p className="text-gray-300 font-medium">{eq.location}</p>
                  </div>
                )}
                {eq.purchaseDate && (
                  <div className="bg-background p-2 rounded-lg border border-[#2A2A2A]">
                    <p className="text-gray-600 font-bold uppercase text-[10px]">Purchased</p>
                    <p className="text-gray-300 font-medium">{new Date(eq.purchaseDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                  </div>
                )}
                {eq.warrantyExpiry && (
                  <div className={`bg-background p-2 rounded-lg border ${warrantyActive ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                    <p className="text-gray-600 font-bold uppercase text-[10px]">Warranty</p>
                    <p className={`font-medium ${warrantyActive ? 'text-emerald-300' : 'text-red-300'}`}>
                      {warrantyActive ? 'Active' : 'Expired'} · {new Date(eq.warrantyExpiry).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {eq.notes && (
                <p className="text-xs text-gray-400 leading-relaxed bg-background p-2.5 rounded-lg border border-[#2A2A2A]">{eq.notes}</p>
              )}
            </div>

            {/* Service contact */}
            {(eq.serviceVendor || eq.serviceContactPerson || eq.servicePhone) && (
              <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#2A2A2A] space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Service Contact
                </p>
                <div className="space-y-1">
                  {eq.serviceVendor && <p className="text-sm font-bold text-white">{eq.serviceVendor}</p>}
                  {eq.serviceContactPerson && <p className="text-xs text-gray-300">{eq.serviceContactPerson}</p>}
                  {eq.servicePhone && (
                    <a href={`tel:${eq.servicePhone}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-orange-400 transition-colors">
                      <Phone className="w-3 h-3" />
                      {eq.servicePhone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Issues section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-gray-600" />
                  Issues ({eq.issues.length})
                </h3>
                <button
                  onClick={() => setShowReportIssue(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-full transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Report Issue
                </button>
              </div>

              {openIssues.length > 0 && (
                <div className="space-y-2">
                  {openIssues.map(renderIssue)}
                </div>
              )}

              {fixedIssues.length > 0 && (
                <details className="group">
                  <summary className="text-[11px] font-semibold text-gray-500 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-1">
                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                    {fixedIssues.length} resolved issue{fixedIssues.length > 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {fixedIssues.map(renderIssue)}
                  </div>
                </details>
              )}

              {eq.issues.length === 0 && (
                <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-center">
                  <p className="text-xs text-gray-500">No issues reported. Equipment is running smoothly.</p>
                </div>
              )}
            </div>

            {/* Maintenance section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-gray-600" />
                  Maintenance ({eq.maintenanceLogs.length})
                </h3>
                <button
                  onClick={() => setShowAddMaintenance(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-full transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Service
                </button>
              </div>

              {eq.maintenanceLogs.length > 0 ? (
                <div className="space-y-2">
                  {eq.maintenanceLogs
                    .slice()
                    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
                    .map((m) => (
                      <div key={m.id} className="bg-[#1E1E1E] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white">{m.description}</p>
                          <span className="text-[10px] text-gray-600">{new Date(m.serviceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          {m.performedBy && <span>By: <span className="text-gray-300">{m.performedBy}</span></span>}
                          {m.cost != null && <span>Cost: <span className="text-gray-300">₹{m.cost.toLocaleString('en-IN')}</span></span>}
                          {m.nextDueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Next: {new Date(m.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-center">
                  <p className="text-xs text-gray-500">No maintenance records yet.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Report Issue Overlay */}
        {showReportIssue && (
          <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
            <motion.form
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              onSubmit={(e) => void handleReportIssue(e)}
              className="w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] p-6 space-y-4"
            >
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Report Issue — {eq.name}
              </h3>
              <input
                type="text"
                required
                placeholder="What's wrong? e.g. Making grinding noise"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none placeholder:text-gray-600"
                autoFocus
              />
              <textarea
                placeholder="Details (optional)"
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none placeholder:text-gray-600 resize-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowReportIssue(false)} className="flex-1 py-2.5 bg-[#2A2A2A] text-gray-300 font-bold text-sm rounded-lg hover:bg-[#333] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!issueTitle.trim()} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50">
                  Report
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {/* Mark Fixed Overlay */}
        {fixingIssueId && (
          <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] p-6 space-y-4"
            >
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                How was it fixed?
              </h3>
              <textarea
                placeholder="What fixed it? This helps next time."
                value={fixSummary}
                onChange={(e) => setFixSummary(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-600 resize-none"
                autoFocus
              />
              <input
                type="text"
                placeholder="Fixed by (person or vendor)"
                value={fixedBy}
                onChange={(e) => setFixedBy(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-600"
              />
              <input
                type="number"
                placeholder="Cost (₹) — optional"
                value={fixCost}
                onChange={(e) => setFixCost(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-600"
              />
              <div className="flex gap-2">
                <button onClick={() => setFixingIssueId(null)} className="flex-1 py-2.5 bg-[#2A2A2A] text-gray-300 font-bold text-sm rounded-lg hover:bg-[#333] transition-colors">
                  Cancel
                </button>
                <button onClick={() => void handleMarkFixed()} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg transition-colors">
                  Mark Fixed
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Maintenance Overlay */}
        {showAddMaintenance && (
          <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
            <motion.form
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              onSubmit={(e) => void handleAddMaintenance(e)}
              className="w-full max-w-md bg-[#1E1E1E] rounded-t-3xl sm:rounded-xl shadow-2xl border border-[#2A2A2A] p-6 space-y-4"
            >
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-400" />
                Log Maintenance — {eq.name}
              </h3>
              <input
                type="text"
                required
                placeholder="What was done? e.g. AMC service, replaced belt"
                value={maintDesc}
                onChange={(e) => setMaintDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-600"
                autoFocus
              />
              <input
                type="text"
                placeholder="Performed by (person or vendor)"
                value={maintBy}
                onChange={(e) => setMaintBy(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-[#2A2A2A] text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-600"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">Service Date</label>
                  <input
                    type="date"
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="Optional"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Next Service Due</label>
                <input
                  type="date"
                  value={maintNextDue}
                  onChange={(e) => setMaintNextDue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-[#2A2A2A] text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddMaintenance(false)} className="flex-1 py-2.5 bg-[#2A2A2A] text-gray-300 font-bold text-sm rounded-lg hover:bg-[#333] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!maintDesc.trim()} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50">
                  Log Service
                </button>
              </div>
            </motion.form>
          </div>
        )}

        <ConfirmModal
          open={showDeleteConfirm}
          title="Delete equipment?"
          message={`"${eq.name}" and all its issues, responses, and maintenance history will be permanently removed.`}
          onConfirm={async () => {
            await removeEquipment(eq.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </motion.div>
    </>
  );
};
