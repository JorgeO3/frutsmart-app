import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type JSX,
  type PropsWithChildren,
} from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { font, s } from "@utils/responsive";

import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import { StatusBar } from "expo-status-bar";

export type Ok<T> = { ok: true; data: T };
export type Err<E> = { ok: false; error: E };
export type AsyncResult<T, E> = Ok<T> | Err<E>;

export const Ok = <T,>(data: T): Ok<T> => ({ ok: true, data });
export const Err = <E,>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: AsyncResult<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: AsyncResult<T, E>): r is Err<E> => !r.ok;

export interface AppLoaderProps<T, E> {
  isReady: boolean;
  asyncTask: () => Promise<AsyncResult<T, E>>;
  onTaskComplete: (result: T) => void;
  onTaskError: (error: E) => void;
  loadingMessage: string;
  fallbackTimeout?: number;
}

function AppLoaderInner<T, E>({
  isReady,
  asyncTask,
  onTaskComplete,
  onTaskError,
  loadingMessage,
}: PropsWithChildren<AppLoaderProps<T, E>>): JSX.Element {
  /* Track mount status to avoid set-state-after-unmount. */
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* Memoised callbacks so React.memo has stable props. */
  const handleComplete = useCallback(
    (data: T) => mountedRef.current && onTaskComplete(data),
    [onTaskComplete],
  );

  const handleError = useCallback(
    (err: E) => mountedRef.current && onTaskError(err),
    [onTaskError],
  );

  /* Run the async task once when ready. */
  const runTask = useCallback(() => {
    asyncTask()
      .then((res) => {
        if (!mountedRef.current) return;

        (res as AsyncResult<T, E>).ok
          ? handleComplete((res as Ok<T>).data)
          : handleError((res as Err<E>).error);
      })
      .catch(handleError);
  }, [asyncTask, handleComplete, handleError]);

  useEffect(() => {
    if (isReady) runTask();
  }, [isReady, runTask]);

  /* Memoised styles to avoid allocations on every render. */
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: s(24), // was 24
        },
        logoBox: { width: s(200), height: s(200), marginBottom: s(20) },
        spinner: { marginTop: s(20) },
        message: { marginTop: s(12), fontSize: font.scale(14, { min: 12 }) },
      }),
    [],
  );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.logoBox}>
          <AppImage
            alt="FrutoSmart Logo"
            source={require("@/assets/images/logo.webp")}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
        <AppText
          style={{
            fontSize: font.scale(60),
            fontWeight: "900",
            color: "#e13510",
          }}
        >
          FrutSmart
        </AppText>
        <AppText
          style={{
            fontSize: font.scale(16),
            color: "#185527",
            fontWeight: "400",
          }}
        >
          Tecnología que Cultiva el futuro
        </AppText>

        <ActivityIndicator
          size="large"
          color="#e13510"
          style={styles.spinner}
        />
        <AppText style={styles.message}>{loadingMessage}</AppText>
      </View>

      <StatusBar style="dark" />
    </>
  );
}

const AppLoader = memo(AppLoaderInner) as typeof AppLoaderInner;
export default AppLoader;
