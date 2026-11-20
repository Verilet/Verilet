import { UserButton } from '@clerk/react';
import { useAuthState } from './authState';

/** Props for the header's account menu. */
interface AccountMenuProps {
  /** Accessible name for the preview avatar shown when there is no real account. */
  previewLabel?: string;
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
    return <UserButton />;
  }
  return (
    <div className="avatar" role="img" aria-label={previewLabel}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
      </svg>
    </div>
  );
}
