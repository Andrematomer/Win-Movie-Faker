import { getMediaDuration } from '../model/assets';
import {
  patchAudioClips,
  patchClips,
  redo,
  removeClips,
  selectAll,
  setMode2008,
  setResolution,
  splitAtPlayhead,
  trimAtPlayhead,
  undo,
  updateAudioClip,
  updateClip,
  useStore,
} from '../model/store';
import {
  DEFAULT_HYPER_TEXT,
  DEFAULT_SITE_TEXT,
  TRANSITIONS,
  type Clip,
  type ImageClip,
  type PictureFit,
  type VideoClip,
} from '../model/types';
import { Icon } from './icons';

interface Props {
  onImport: () => void;
  onAddTitle: () => void;
  onExport: () => void;
}

const RECOMMENDED = [
  { w: 320, h: 240, label: '320 × 240 (recommended)' },
  { w: 640, h: 480, label: '640 × 480 (recommended)' },
  { w: 800, h: 600, label: '800 × 600 (recommended)' },
];
const MODERN = [
  { w: 854, h: 480, label: '854 × 480 (480p)' },
  { w: 1280, h: 720, label: '1280 × 720 (HD)' },
  { w: 1920, h: 1080, label: '1920 × 1080 (Full HD)' },
  { w: 2560, h: 1440, label: '2560 × 1440 (QHD)' },
  { w: 3840, h: 2160, label: '3840 × 2160 (4K, slow)' },
];

const num = (e: Event) => Number((e.target as HTMLInputElement).value);

/** Do all values agree? `value` is the shared one (or the first, if mixed). */
function agree<T>(vals: T[]): { value: T | undefined; mixed: boolean } {
  const first = vals[0];
  return { value: first, mixed: vals.some((v) => v !== first) };
}

function Link({ onClick, children, disabled }: { onClick: () => void; children: preact.ComponentChildren; disabled?: boolean }) {
  return (
    <a
      href="#"
      class={disabled ? 'disabled' : ''}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
    >
      {children}
    </a>
  );
}

export function TaskPane({ onImport, onAddTitle, onExport }: Props) {
  const project = useStore((s) => s.project);
  const selectedIds = useStore((s) => s.selectedIds);
  const ids = new Set(selectedIds);
  const clips: Clip[] = project.clips.filter((c) => ids.has(c.id));
  const audio = project.audioClips.filter((a) => ids.has(a.id));
  const total = clips.length + audio.length;
  const pics = clips.filter((c): c is ImageClip | VideoClip => c.kind !== 'title');
  const vids = clips.filter((c): c is VideoClip => c.kind === 'video');
  const oneClip = total === 1 ? clips[0] : undefined;
  const oneAudio = total === 1 ? audio[0] : undefined;

  const knownSize = [...RECOMMENDED, ...MODERN].some((r) => r.w === project.width && r.h === project.height);

  const clipIds = clips.map((c) => c.id);
  const picIds = pics.map((c) => c.id);

  const fit = agree(pics.map((c) => c.fit ?? 'fit'));
  const oldCam = pics.map((c) => !!c.oldCamera);
  const wmHyper = pics.map((c) => !!c.wmHyper);
  const wmSite = pics.map((c) => !!c.wmSite);
  const hyperText = agree(pics.map((c) => c.wmHyperText ?? DEFAULT_HYPER_TEXT));
  const siteText = agree(pics.map((c) => c.wmSiteText ?? DEFAULT_SITE_TEXT));
  const transition = agree(clips.map((c) => c.transitionIn));
  const volumes = [...vids.map((c) => c.volume), ...audio.map((a) => a.volume)];
  const volume = agree(volumes);
  const duration = agree(clips.map((c) => c.duration));

  const setVolume = (v: number) => {
    if (vids.length) patchClips(vids.map((c) => c.id), { volume: v });
    if (audio.length) patchAudioClips(audio.map((a) => a.id), { volume: v });
  };

  const checkbox = (id: string, label: string, vals: boolean[], onSet: (on: boolean) => void, hint?: string) => {
    const all = vals.every(Boolean);
    const some = vals.some(Boolean);
    return (
      <div class="check-row">
        <input id={id} type="checkbox" checked={all} onChange={() => onSet(!all)} />
        <label for={id} title={hint}>
          {label}
          {some && !all ? ' (some)' : ''}
        </label>
      </div>
    );
  };

  const durationBounds = (c: Clip | undefined) => ({
    min: c?.kind === 'video' ? 0.5 : 1,
    max: c?.kind === 'video' ? Math.max(0.5, getMediaDuration(c.mediaId) - c.trimStart) : 3600,
  });

  return (
    <div class="taskpane">
      <h3>Movie Tasks</h3>

      <details open>
        <summary>1. Import</summary>
        <Link onClick={onImport}><Icon name="picture" /> Import pictures, video or music</Link>
        <Link onClick={onAddTitle}><Icon name="title" /> Add title or credits</Link>
      </details>

      <details open>
        <summary>2. Edit Movie</summary>
        <Link onClick={undo}>Undo (Ctrl+Z)</Link>
        <Link onClick={redo}>Redo (Ctrl+Y)</Link>
        <Link onClick={selectAll}>Select all clips (Ctrl+A)</Link>
        <Link onClick={splitAtPlayhead} disabled={total !== 1 || oneClip?.kind === 'title'}>
          <Icon name="scissors" /> Split at playhead (S)
        </Link>
        <Link onClick={() => trimAtPlayhead('start')} disabled={total !== 1}>Set start at playhead (I)</Link>
        <Link onClick={() => trimAtPlayhead('end')} disabled={total !== 1}>Set end at playhead (O)</Link>
      </details>

      <details open>
        <summary>3. Finish Movie</summary>
        <div class="check-row">
          <input id="cb-2008" type="checkbox" checked={project.mode2008} onChange={(e) => setMode2008((e.target as HTMLInputElement).checked)} />
          <label for="cb-2008" title="Worse picture and worse sound, like a video uploaded in 2008">2008 YouTube mode (uglier)</label>
        </div>
        <p class="hint-small">Blurrier picture and tinny sound, like a video uploaded in 2008.</p>
        <label>
          Size:{' '}
          <select
            value={`${project.width}x${project.height}`}
            onChange={(e) => {
              const [w, h] = (e.target as HTMLSelectElement).value.split('x').map(Number);
              setResolution(w!, h!);
            }}
          >
            {RECOMMENDED.map((r) => (
              <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>
            ))}
            {MODERN.map((r) => (
              <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>
            ))}
            {!knownSize && <option value={`${project.width}x${project.height}`}>{project.width} × {project.height}</option>}
          </select>
        </label>
        <Link onClick={onExport}><Icon name="save" /> Save to my computer</Link>
      </details>

    </div>
  );
}
