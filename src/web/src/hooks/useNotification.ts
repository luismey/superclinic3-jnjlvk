import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Toast } from '../components/common/Toast';

// Constants for notification configuration
const DEFAULT_DURATION = 5000;
const DEFAULT_POSITION = 'top-right' as const;
const MAX_NOTIFICATIONS = 5;
const ANIMATION_DURATION = 300;
const NOTIFICATION_LIMIT = 10;

// Type definitions for notification options and state
export interface NotificationOptions {
  variant?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

interface Notification extends Required<NotificationOptions> {
  id: string;
  createdAt: number;
  visible: boolean;
}

export interface NotificationHook {
  showNotification: (options: NotificationOptions) => void;
  clearNotifications: () => void;
  dismissNotification: (id: string) => void;
}

/**
 * Creates a new notification object with validated options and defaults
 */
const createNotification = (options: NotificationOptions, id: string): Notification => {
  return {
    id,
    variant: options.variant || 'info',
    message: options.message,
    duration: options.duration || DEFAULT_DURATION,
    position: options.position || DEFAULT_POSITION,
    createdAt: Date.now(),
    visible: true
  };
};

/**
 * Custom hook for managing toast notifications with accessibility and responsive support
 * @returns {NotificationHook} Object containing notification management functions
 */
export const useNotification = (): NotificationHook => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationQueue, setNotificationQueue] = useState<Notification[]>([]);
  const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const prefersReducedMotion = useRef<boolean>(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Process notification queue
  useEffect(() => {
    if (notificationQueue.length > 0 && notifications.length < MAX_NOTIFICATIONS) {
      const nextNotification = notificationQueue[0];
      setNotifications(prev => [...prev, nextNotification]);
      setNotificationQueue(prev => prev.slice(1));
    }
  }, [notifications, notificationQueue]);

  /**
   * Dismisses a specific notification
   */
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, visible: false }
          : notification
      )
    );

    // Remove notification after animation
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      delete timersRef.current[id];
    }, prefersReducedMotion.current ? 0 : ANIMATION_DURATION);

    timersRef.current[`remove_${id}`] = timer;
  }, []);

  /**
   * Shows a new notification with the provided options
   */
  const showNotification = useCallback((options: NotificationOptions) => {
    if (!options.message) {
      console.error('Notification message is required');
      return;
    }

    const id = uuidv4();
    const notification = createNotification(options, id);

    if (notifications.length >= MAX_NOTIFICATIONS) {
      if (notificationQueue.length >= NOTIFICATION_LIMIT - MAX_NOTIFICATIONS) {
        console.warn('Notification queue limit reached');
        return;
      }
      setNotificationQueue(prev => [...prev, notification]);
    } else {
      setNotifications(prev => [...prev, notification]);
    }

    // Set auto-dismiss timer if duration is provided
    if (notification.duration > 0) {
      const timer = setTimeout(() => {
        dismissNotification(id);
        delete timersRef.current[id];
      }, notification.duration);

      timersRef.current[id] = timer;
    }
  }, [notifications.length, dismissNotification]);

  /**
   * Clears all active notifications
   */
  const clearNotifications = useCallback(() => {
    // Clear all timers
    Object.values(timersRef.current).forEach(timer => clearTimeout(timer));
    timersRef.current = {};

    // Mark all notifications as invisible for animation
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, visible: false }))
    );

    // Remove all notifications after animation
    const timer = setTimeout(() => {
      setNotifications([]);
      setNotificationQueue([]);
    }, prefersReducedMotion.current ? 0 : ANIMATION_DURATION);

    timersRef.current.clearAll = timer;
  }, []);

  return {
    showNotification,
    clearNotifications,
    dismissNotification
  };
};