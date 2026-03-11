/**
 * Notification queue: show one message at a time; user acknowledges to see the next.
 * Replaces ref-based queue with useReducer for testability and clearer flow.
 */

import { useReducer, useCallback } from 'react';

interface NotificationState {
  queue: string[];
  current: string | null;
}

type NotificationAction =
  | { type: 'ENQUEUE'; message: string }
  | { type: 'ACKNOWLEDGE' };

function notificationReducer(
  state: NotificationState,
  action: NotificationAction
): NotificationState {
  switch (action.type) {
    case 'ENQUEUE': {
      if (state.current === null) {
        return { queue: [], current: action.message };
      }
      return {
        queue: [...state.queue, action.message],
        current: state.current,
      };
    }
    case 'ACKNOWLEDGE': {
      const next = state.queue[0] ?? null;
      return {
        queue: state.queue.slice(1),
        current: next,
      };
    }
    default:
      return state;
  }
}

export interface UseNotificationQueueReturn {
  notificationOpen: boolean;
  currentNotification: string | null;
  queueToast: (message: string) => void;
  handleNotificationAcknowledge: () => void;
}

export function useNotificationQueue(): UseNotificationQueueReturn {
  const [state, dispatch] = useReducer(notificationReducer, {
    queue: [],
    current: null,
  });

  const queueToast = useCallback((message: string) => {
    dispatch({ type: 'ENQUEUE', message });
  }, []);

  const handleNotificationAcknowledge = useCallback(() => {
    dispatch({ type: 'ACKNOWLEDGE' });
  }, []);

  return {
    notificationOpen: state.current !== null,
    currentNotification: state.current,
    queueToast,
    handleNotificationAcknowledge,
  };
}
