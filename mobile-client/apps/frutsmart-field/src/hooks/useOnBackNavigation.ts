import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import type {
  EventArg,
  ParamListBase,
  NavigationProp,
  NavigationAction,
} from '@react-navigation/native';

interface Options { wait?: boolean }

type BeforeRemoveEvent = EventArg<
  'beforeRemove',
  true,
  { action: NavigationAction }
>;

export function useOnBackNavigation(
  cb: () => void | Promise<void>,
  { wait = false }: Options = {},
) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const running = useRef(false);

  const handler = useCallback(
    async (e: BeforeRemoveEvent) => {
      /* ⚠️ Ignoramos REPLACE, RESET, etc. */
      const type = e.data?.action?.type;
      if (type !== 'POP' && type !== 'GO_BACK') return; // IGNORE ALL EVENTS EXCEPT POP AND GO_BACK

      if (wait) {
        e.preventDefault();                              // bloquea pop
        if (running.current) return;
        running.current = true;
        try {
          await cb();
        } finally {
          running.current = false;
          navigation.dispatch(e.data.action);           // relanza POP
        }
      } else {
        cb();                                            // síncrono
      }
    },
    [cb, wait, navigation],
  );

  useEffect(() => navigation.addListener('beforeRemove', handler), [
    navigation,
    handler,
  ]);
}
