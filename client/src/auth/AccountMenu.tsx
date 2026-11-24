import { lazy, Suspense } from 'react';
import { useAuthState } from './authState';

/**
 * Clerk's account button. Importing it here directly would make the header download Clerk even
 * when nobody is signed in with Clerk (for example the development preview), so it loads only
 * for a real Clerk session.
 */
const ClerkUserButton = lazy(() => import('./ClerkUserButton'));

/** Props for the header's account menu. */
interface AccountMenuProps {
  /** Accessible name for the preview avatar shown when there is no real account. */
  previewLabel?: string;
}

/** Props for the plain avatar. */
interface AvatarProps {
  /** Accessible name; leave it out for a placeholder that screen readers skip. */
  label?: string;
}

/**
 * A plain person avatar, used for the development preview and while Clerk's button loads.
 *
 * @param props The avatar's props.
 * @param props.label Accessible name; without one the avatar is hidden from screen readers.
 * @returns The avatar.
 */
function Avatar({ label }: AvatarProps) {
  const a11y = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  return (
    <div className="avatar" {...a11y}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * The signed-in person's menu in the header: Clerk's account button for a real account, or a
 * plain avatar for the development preview, where there is no account to show.
 *
 * @param props The menu's props.
 * @param props.previewLabel Accessible name for the preview avatar.
 * @returns Clerk's account button, or the preview avatar.
 */
export default function AccountMenu({ previewLabel = 'Preview account' }: AccountMenuProps) {
  const { configured, isSignedIn } = useAuthState();

  if (configured && isSignedIn) {
    return (
      <Suspense fallback={<Avatar />}>
        <ClerkUserButton />
      </Suspense>
    );
  }
  return <Avatar label={previewLabel} />;
}
