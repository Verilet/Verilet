import { UserButton } from '@clerk/react';
import { useAuthState } from './authState';

/**
 * The signed-in person's menu in the header: Clerk's account button when Clerk is signed in, or
 * the initials avatar for the development preview, where there is no real account.
 */
export default function AccountMenu({ initials }: { initials: string }) {
  const { configured, isSignedIn } = useAuthState();

  if (configured && isSignedIn) {
    return <UserButton />;
  }
  return (
    <div className="avatar" role="img" aria-label={`Signed in as ${initials}`}>
      {initials}
    </div>
  );
}
