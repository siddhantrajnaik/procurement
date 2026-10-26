import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import * as api from '../lib/api';

interface Props {
  /** A photo chosen in this form, uploaded when the form is saved. */
  file: File | null;
  onFile: (f: File | null) => void;
  /** The photo already attached to the request (edit form only). */
  existingPath?: string | null;
  /** True once the person has removed the existing photo in this form. */
  removeExisting?: boolean;
  onRemoveExisting?: (remove: boolean) => void;
}

const MAX_RAW_BYTES = 25 * 1024 * 1024;

/** Optional photo for the vendor page. Held in the form until Save so Cancel discards it. */
export const VendorPhotoField: React.FC<Props> = ({ file, onFile, existingPath, removeExisting, onRemoveExisting }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local preview of the newly chosen file.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A short-lived link to the photo that is already attached.
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setExistingUrl(null);
    if (existingPath) void api.vendorPhotoPreviewUrl(existingPath).then((u) => { if (live) setExistingUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [existingPath]);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Choose a photo, not a document.'); return; }
    if (f.size > MAX_RAW_BYTES) { setError('That photo is very large. Try another.'); return; }
    onFile(f);
    onRemoveExisting?.(false);
  };

  const shown = file ? preview : existingPath && !removeExisting ? existingUrl : null;
  const has = !!file || (!!existingPath && !removeExisting);

  return (
    <div className="rounded-lg border border-[#2A2A2A] bg-background p-3 space-y-2">
      <div className="flex items-center gap-3">
        {has ? (
          <div className="w-16 h-16 rounded-md bg-[#161616] border border-[#2A2A2A] overflow-hidden shrink-0 flex items-center justify-center">
            {shown ? <img src={shown} alt="Photo for vendors" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-gray-600" />}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Photo for vendors <span className="text-gray-500 font-normal">(optional)</span></p>
          <p className="text-[11px] text-gray-400">Helps vendors recognise the item. Removed automatically once it is ordered, or after 30 days.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 min-h-10 rounded-md bg-[#2A2A2A] text-xs font-semibold text-gray-200 hover:bg-[#333]"
        >
          {has ? 'Replace photo' : 'Add a photo'}
        </button>
        {has && (
          <button
            type="button"
            onClick={() => { onFile(null); if (existingPath) onRemoveExisting?.(true); }}
            className="min-h-10 px-3 rounded-md text-xs font-semibold text-red-300 hover:bg-red-500/10 inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
      />
      {error && <p role="alert" className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
