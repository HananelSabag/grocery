import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShoppingBasket, Users } from 'lucide-react';

import { lookupListByCode, useJoinList } from '../hooks/useSharing';
import { useAuth } from '../stores/auth';
import { useActiveList } from '../stores/activeList';
import { takeReturnTo } from '../lib/returnTo';
import { useTranslation } from '../i18n';
import Logo from '../components/Logo';
import Splash from '../components/Splash';
import SignIn from './SignIn';

/**
 * Where a shared link lands.
 *
 * Signed out — the usual case for someone the link was sent to — it is a sign-in
 * screen that says they have been invited. Google always returns people to "/",
 * so the sign-in screen writes this address down first and the app brings them
 * back here afterwards (lib/returnTo.js). Without that, a new person signed in,
 * landed on the empty list sign-up had just made for them, and never joined.
 *
 * Signed in, it names the list before joining it. A link gets forwarded — that
 * is what a permanent link is for — and whoever ends up tapping it should see
 * whose shopping list they are about to be added to. Somebody already on the
 * list is simply taken to it.
 */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const setActiveList = useActiveList((s) => s.setListId);
  const join = useJoinList();

  const [found, setFound] = useState(undefined); // undefined = still looking
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !user) return undefined;

    // Arrived. Whatever was written down on the way out has done its job, and
    // must not send the person back here the next time they open the app.
    takeReturnTo();

    let cancelled = false;
    lookupListByCode(code)
      .then((row) => {
        if (cancelled) return;
        if (row?.already_member) {
          setActiveList(row.list_id);
          navigate('/', { replace: true });
          return;
        }
        setFound(row);
      })
      .catch(() => { if (!cancelled) setFound(null); });

    return () => { cancelled = true; };
  }, [ready, user, code, navigate, setActiveList]);

  const confirm = useCallback(async () => {
    try {
      await join.mutateAsync(code);
      navigate('/', { replace: true });
    } catch {
      setFailed(true);
    }
  }, [join, code, navigate]);

  if (!ready) return <Splash />;
  if (!user) return <SignIn intent="join" />;

  const shell = (children) => (
    <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      {children}
    </div>
  );

  if (found === undefined) {
    return shell(
      <>
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="text-[13px] text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      </>
    );
  }

  if (found === null || failed) {
    return shell(
      <>
        <ShoppingBasket className="h-12 w-12 text-gray-300 dark:text-gray-700" />
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-50">{t('join.notFound')}</p>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('join.notFoundHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="glass min-h-[44px] rounded-2xl px-6 font-bold text-gray-700 dark:text-gray-200"
        >
          {t('join.toMyList')}
        </button>
      </>
    );
  }

  return shell(
    <>
      <Logo size={64} />

      <div className="glass w-full max-w-xs rounded-3xl p-5">
        <p className="text-[13px] text-gray-500 dark:text-gray-400">{t('join.invitedTo')}</p>

        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-50">
          {found.list_name?.trim()
            || t('lists.someones', { name: (found.owner_name || '').trim().split(/\s+/)[0] || t('lists.someone') })}
        </p>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500">
          <Users className="h-3.5 w-3.5" />
          {t('join.memberCount', { count: found.member_count })}
        </p>

        <button
          type="button"
          onClick={confirm}
          disabled={join.isPending}
          className="gradient-action gradient-glow mt-4 flex min-h-[46px] w-full items-center
                     justify-center rounded-2xl font-bold text-white transition active:scale-95
                     disabled:opacity-70"
        >
          {join.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join.confirm')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="text-[13px] font-semibold text-gray-400 dark:text-gray-500"
      >
        {t('common.cancel')}
      </button>
    </>
  );
}
