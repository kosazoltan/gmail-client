import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushNotificationState {
  permission: PermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  // Ellenőrizzük a push notification támogatást
  useEffect(() => {
    const checkSupport = async () => {
      // PWA-ban vagyunk-e?
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

      // Service Worker és Push API támogatás
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState((prev) => ({
          ...prev,
          permission: 'unsupported',
          isLoading: false,
          error: isStandalone ? null : 'Push értesítések csak telepített alkalmazásban működnek',
        }));
        return;
      }

      // Jelenlegi permission állapot
      const permission = Notification.permission as PermissionState;

      // Van-e aktív subscription?
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState((prev) => ({
          ...prev,
          permission,
          isSubscribed: !!subscription,
          isLoading: false,
        }));
      } catch (error) {
        console.error('Push check error:', error);
        setState((prev) => ({
          ...prev,
          permission,
          isLoading: false,
        }));
      }
    };

    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Kérjük az engedélyt
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((prev) => ({
          ...prev,
          permission: permission as PermissionState,
          isLoading: false,
          error: 'Push értesítések engedélyezése szükséges',
        }));
        return false;
      }

      // VAPID public key lekérése
      const { publicKey } = await api.push.getVapidKey();
      if (!publicKey) {
        throw new Error('VAPID key not available');
      }

      // Service Worker subscription
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Subscription küldése a szervernek
      await api.push.subscribe(subscription.toJSON());

      setState((prev) => ({
        ...prev,
        permission: 'granted',
        isSubscribed: true,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Push subscribe error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Push értesítések bekapcsolása sikertelen',
      }));
      return false;
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Töröljük a szerverről
        await api.push.unsubscribe(subscription.endpoint);
        // Töröljük lokálisan
        await subscription.unsubscribe();
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Push értesítések kikapcsolása sikertelen',
      }));
      return false;
    }
  }, []);

  // Teszt notification küldése
  const sendTest = useCallback(async () => {
    try {
      await api.push.test();
      return true;
    } catch (error) {
      console.error('Push test error:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendTest,
    isSupported: state.permission !== 'unsupported',
  };
}

// VAPID key konvertálása
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
