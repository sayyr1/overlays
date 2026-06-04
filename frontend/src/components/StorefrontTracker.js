import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicConfig } from '../context/PublicConfigContext';
import { ensureVisitorSession, trackStoreVisit } from '../services/crmTracking';

const isTrackablePath = pathname =>
  !(
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/admin-dashboard') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/pedidos') ||
    pathname.startsWith('/ventas') ||
    pathname.startsWith('/gestionar-categorias') ||
    pathname.startsWith('/menu-builder') ||
    pathname.startsWith('/crear-producto') ||
    pathname.startsWith('/editar-producto') ||
    pathname.startsWith('/crm')
  );

const StorefrontTracker = () => {
  const location = useLocation();
  const { isModuleEnabled } = usePublicConfig();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isModuleEnabled('crm') || !isTrackablePath(location.pathname)) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const payload = {
      landingPage: `${location.pathname}${location.search}`,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || ''
    };

    if (!initializedRef.current) {
      initializedRef.current = true;
      ensureVisitorSession(payload);
      return;
    }

    trackStoreVisit(payload);
  }, [isModuleEnabled, location.pathname, location.search]);

  return null;
};

export default StorefrontTracker;
