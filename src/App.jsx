import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
