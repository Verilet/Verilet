import { UserButton } from '@clerk/react';

/**
 * Clerk's account button, in its own file so `AccountMenu` can load it on demand. Only a real
 * Clerk session shows it, and by then `ClerkAuth` has already downloaded Clerk, so loading this
 * costs nothing extra.
 *
 * @returns Clerk's account button.
 */
export default function ClerkUserButton() {
  return <UserButton />;
}
