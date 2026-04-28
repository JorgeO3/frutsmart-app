import type React from "react";
import { useEffect, useRef } from "react";
import {
  View,
  useWindowDimensions,
  Dimensions,
  InteractionManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from "@react-navigation/native";

export default function DebugWrapper({
  children,
}: { children: React.ReactNode }) {
  const { width: winW, height: winH } = useWindowDimensions(); // auto‐actualiza
  const screen = Dimensions.get("screen"); // dims totales
  const headerH = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const viewRef = useRef<View>(null);
  const layout = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // biome-ignore format: true
  const dump = (tag: string) =>
    console.log(
      `[${tag}] win=${winW}×${winH}, screen=${screen.width}×${screen.height}, header=${headerH}, insetTop=${insets.top}, layout=`,
      layout.current,
    );

  // biome-ignore format: true
  // biome-ignore lint/correctness/useExhaustiveDependencies: true
  useEffect(() => {
    dump("mount");
    // posición absoluta en ventana
    viewRef.current?.measureInWindow((x, y, w, h) => {
      console.log("[measureInWindow] ", { x, y, w, h });
    });
  }, []);

  // biome-ignore format: true
  // biome-ignore lint/correctness/useExhaustiveDependencies: true
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      dump('focus');
      // offsets de frame y page
      viewRef.current?.measure((fx, fy, w, h, px, py) => {
        console.log('[measure] frameOffset=', fx, fy, 'pageOffset=', px, py, 'size=', w, h);
      });
    });
    return unsub;
  }, [navigation]);

  // biome-ignore format: true
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      InteractionManager.runAfterInteractions(() => {
        viewRef.current?.measureInWindow((x, y, w, h) => {
          console.log("[post-transition] coords:", { x, y, w, h });
        });
      });
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <View
      ref={viewRef}
      style={{ flex: 1 }}
      onLayout={(e) => {
        layout.current = e.nativeEvent.layout; // relativo al padre
        dump("onLayout");
      }}
    >
      {children}
    </View>
  );
}
