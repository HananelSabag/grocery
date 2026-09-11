import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ShoppingBasket } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../stores/auth';
import { useLanguage } from '../i18n';
import SignIn from './SignIn';
import Splash from '../components/Splash';

/**
 * The one screen someone can land on having never used the app.
 *
 * The flow is: sign in first (the invitation is redeemed as a user, so there
 * is nobody to add before that), then redeem, then go to the list. Because
 * Google sign-in leaves and re-enters the page, the token has to survive a
 * full reload — it comes from the URL, which it does.
 */
export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useLanguage((s) => s.t);

  const { user, ready } = useAuth();
  const [error, setError] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!ready || !user || attempted.current) return;
    attempted.current = true;

    (async () => {
      const { error: rpcError } = await supabase.rpc('accept_invitation', { p_token: token });
      if (rpcError) {
        setError(rpcError);
        return;
      }
      // The membership changed, so the list this user resolves to may have too.
      await queryClient.invalidateQueries();
      navigate('/', { replace: true });
    })();
  }, [ready, user, token, navigate, queryClient]);

  if (!ready) return <Splash />;

  // Sign in first — and come back here afterwards, not to the list, so the
  // token still gets redeemed.
  if (!user) return <SignIn />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <ShoppingBasket className="h-12 w-12 text-gray-300 dark:text-gray-700" />
        <p className="text-gray-600 dark:text-gray-300">{t('members.inviteInvalid')}</p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="min-h-touch rounded-xl bg-brand-600 px-6 font-semibold text-white"
        >
          {t('common.close')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Check className="h-10 w-10 animate-pulse text-brand-600 dark:text-brand-400" />
      <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
    </div>
  );
}
