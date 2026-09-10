import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { GuestIdentity } from './guestIdentity';

interface Props {
  initial?: GuestIdentity | null;
  onSave: (identity: GuestIdentity) => void;
  onCancel?: () => void;
}

/**
 * Asked once, on first entry. Everything a visitor logs afterwards carries this
 * name, so it is the one piece of typing the guest flow cannot avoid.
 */
export const GuestIdentityGate: React.FC<Props> = ({ initial, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [affiliation, setAffiliation] = useState(initial?.affiliation ?? '');

  const valid = name.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ name: name.trim(), affiliation: affiliation.trim() });
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
          <UserRound className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
          {initial ? 'Update your details' : 'Welcome to MB Lab'}
        </h1>
        <p className="text-sm text-gray-400 mb-7 leading-relaxed">
          Your name goes on the instrument log, so the lab knows who used what.
          It stays on this device.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5" htmlFor="guest-name">
              Your name
            </label>
            <input
              id="guest-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              className="w-full px-4 py-3 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5" htmlFor="guest-affiliation">
              Institute or lab
              <span className="text-gray-500 font-normal normal-case ml-1">(optional)</span>
            </label>
            <input
              id="guest-affiliation"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="e.g. IIT Kanpur"
              className="w-full px-4 py-3 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-gray-600"
            />
          </div>

          <div className="flex gap-3 pt-1">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-lg bg-[#2A2A2A] hover:bg-[#333] text-gray-200 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!valid}
              className="flex-1 py-3 rounded-lg bg-primary hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {initial ? 'Save' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
