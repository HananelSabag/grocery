import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './stores/auth';
import SignIn from './pages/SignIn';
import Splash from './components/Splash';

const ListPage    = lazy(() => import('./pages/ListPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const InvitePage  = lazy(() => import('./pages/InvitePage'));

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
      <Routes>
        <Route path="/" element={<Protected><ListPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

        {/* The one route that may be opened by someone who has never been
            here: it signs them in first, then redeems the token. */}
        <Route path="/invite/:token" element={<InvitePage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
