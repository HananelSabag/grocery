import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShoppingBasket, Users } from 'lucide-react';

import { lookupListByCode, useJoinList } from '../hooks/useSharing';
import { useAuth } from '../stores/auth';
import { useTranslation } from '../i18n';
import Logo from '../components/Logo';
import Splash from '../components/Splash';
import SignIn from './SignIn';

/**
 * Landing on a shared code, from a link.
 *
 * It asks before joining rather than joining on arrival. A link gets forwarded
 * — that is the point of a standing code — and the person who ends up tapping
 * it should see whose shopping list they are about to be added to, by name,
 * before they are on it.
 *
 * Sign-in comes first, because there is nobody to add until there is an
 * account. Google leaves and re-enters the page, so the code has to survive a
 * full reload: it is in the URL, which it does.
 */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const join = useJoinList();

  const [found, setFound] = useState(undefined); // undefined = still looking
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;

    lookupListByCode(code)
      .then((row) => { if (!cancelled) setFound(row); })
      .catch(() => { if (!cancelled) setFound(null); });

    return () => { cancelled = true; };
  }, [ready, user, code]);

  const confirm = useCallback(async () => {
    try {
      await join.mutateAsync(code);
      navigate('/', { replace: true });
    } catch {
      setFailed(true);
    }
  }, [join, code, navigate]);

  if (!ready) return <Splash />;
  if (!user) return <SignIn />;

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
            || t('lists.someones', { name: found.owner_name || t('lists.someone') })}
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
