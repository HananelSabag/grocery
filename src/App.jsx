import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { checkForUpdate } from './lib/pwa';
import { useAuth } from './stores/auth';
import SignIn from './pages/SignIn';
import Splash from './components/Splash';
import InstallPrompt from './components/InstallPrompt';
import UpdateGate from './components/UpdateGate';

const ListPage    = lazy(() => import('./pages/ListPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const InvitePage  = lazy(() => import('./pages/InvitePage'));
const JoinPage    = lazy(() => import('./pages/JoinPage'));
const AdminPage   = lazy(() => import('./pages/AdminPage'));

/**
 * Everything behind sign-in, which is everything except the invite link.
 *
 * `ready` is checked before `user`: until Supabase has read the stored session,
 * "no user" means "we haven't looked", and rendering SignIn on that would flash
 * the sign-in screen at a signed-in user on every reload.
 */
const Protected = ({ children }) => {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <SignIn />;
  return children;
};

/** How long to allow for a newer build to arrive and claim the path. */
const UNKNOWN_ROUTE_GRACE_MS = 10_000;

/**
 * A path this build does not recognise.
 *
 * Usually a typo, and the old behaviour — redirect to the list — was right for
 * that. But it is also exactly what a brand-new route looks like to a device
 * still running yesterday's build out of the service worker's cache, and that
 * case is not cosmetic: /join/ABC123 shipped today, so the first person to be
 * sent one is the most likely person to be holding a shell that has never
 * heard of it. Redirecting immediately throws the code away and the share
 * looks broken again, for a completely different reason.
 *
 * So ask for a new build and hold the URL for a moment. If one arrives the
 * page reloads onto it with the path intact and the route resolves; if not,
 * this was a typo after all.
 */
const UnknownRoute = () => {
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    checkForUpdate();
    const timer = setTimeout(() => setGiveUp(true), UNKNOWN_ROUTE_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  return giveUp ? <Navigate to="/" replace /> : <Splash />;
};

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      {/* Offered from anywhere, shown once, never over the first screen. */}
      <InstallPrompt />

      {/* Only ever appears when a new build could not take over quietly. */}
      <UpdateGate />

      <Routes>
        <Route path="/" element={<Protected><ListPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

        {/* Signed-in only, like everything else. Being an admin is not checked
            here — the screen's own queries are SECURITY DEFINER functions that
            refuse anyone who is not one, so a typed URL gets a refusal screen
            rather than data. */}
        <Route path="/admin" element={<Protected><AdminPage /></Protected>} />

        {/* The two routes that may be opened by someone who has never been
            here: both sign them in first, then add them to the list.

            /join is the current one and carries the list's standing code, so
            the same link works next month and for whoever it gets forwarded
            to. /invite carries a one-time token and stays only because links
            of that shape were already sent to people. */}
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />

        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </Suspense>
  );
}
