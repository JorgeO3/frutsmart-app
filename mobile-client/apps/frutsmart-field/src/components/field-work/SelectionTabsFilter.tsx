import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  type LayoutChangeEvent,
  TextInput,
} from "react-native";

import Animated, {
  FadeIn,
  FadeOut,
  withSpring,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  LinearTransition,
} from "react-native-reanimated";
import { useForm } from "react-hook-form";
import { FlashList } from "@shopify/flash-list";
import type { FlashListProps } from "@shopify/flash-list";

import AppIcon from "../AppIcon";
import AppImage from "../AppImage";
import AppButton from "@components/AppButton";

// ==== Tipos ====
export type Item = { id: string; label: string };

interface Props {
  onContinue: (ids: string[]) => void;
}
type FormValues = { selectedItems: string[] };

// ==== Datos de ejemplo ====
const LOTE_ITEMS: Item[] = [
  { id: "IS01", label: "IS01" },
  { id: "IS02", label: "IS02" },
  { id: "IT01", label: "IT01" },
  { id: "IT02", label: "IT02" },
  { id: "IT03", label: "IT03" },
  { id: "IT04", label: "IT04" },
  { id: "IT05", label: "IT05" },
  { id: "IT06", label: "IT06" },
  { id: "IT07", label: "IT07" },
  { id: "IT08", label: "IT08" },
  { id: "IT09", label: "IT09" },
  { id: "IT10", label: "IT10" },
  { id: "IT11", label: "IT11" },
  { id: "IT12", label: "IT12" },
  { id: "IT13", label: "IT13" },
  { id: "IT14", label: "IT14" },
  { id: "IT15", label: "IT15" },
];
const CENTRO_ITEMS: Item[] = [
  { id: "C01", label: "C01" },
  { id: "C02", label: "C02" },
  { id: "C03", label: "C03" },
  { id: "C04", label: "C04" },
  { id: "C05", label: "C05" },
  { id: "C06", label: "C06" },
  { id: "C07", label: "C07" },
  { id: "C08", label: "C08" },
  { id: "C09", label: "C09" },
  { id: "C10", label: "C10" },
  { id: "C11", label: "C11" },
  { id: "C12", label: "C12" },
  { id: "C13", label: "C13" },
  { id: "C14", label: "C14" },
  { id: "C15", label: "C15" },
];

async function fetchItems(
  tab: "lote" | "centro",
  filter: string,
): Promise<Item[]> {
  const source = tab === "lote" ? LOTE_ITEMS : CENTRO_ITEMS;
  await new Promise((r) => setTimeout(r, 300));
  return filter
    ? source.filter((it) =>
        it.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : source;
}

// ==== Componentes Animados ====
const AnimatedFlashList =
  Animated.createAnimatedComponent<FlashListProps<Item>>(FlashList);

// Card con feedback táctil
function AnimatedCard({
  label,
  isSelected,
  onPress,
  imgSrc,
}: {
  label: string;
  imgSrc: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const ani = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.95);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[styles.card, ani, isSelected && styles.cardSelected]}
      >
        <AppImage
          source={imgSrc}
          style={{ width: 80, height: 80 }}
          alt="Imagen de selección"
        />
        <Text style={styles.cardText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// Grid sin columnWrapperStyle
function ItemsGrid({
  items,
  selected,
  toggle,
}: {
  items: Item[];
  selected: string[];
  toggle: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const icon = require("@assets/images/palm-oil-icon.svg");
  return (
    <AnimatedFlashList
      data={items}
      extraData={selected}
      keyExtractor={(i) => i.id}
      numColumns={2}
      estimatedItemSize={width * 0.5}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: SPACING,
      }}
      renderItem={({ item, index }) => {
        const isLeft = index % 2 === 0;
        const isSel = selected.includes(item.id);
        return (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            layout={LinearTransition.springify()}
            style={[
              {
                flex: 1,
                aspectRatio: 1,
                marginBottom: SPACING,
              },
              // margen horizontal para separar columnas
              isLeft
                ? { marginRight: SPACING / 2 }
                : { marginLeft: SPACING / 2 },
            ]}
          >
            <AnimatedCard
              imgSrc={icon}
              label={item.label}
              isSelected={isSel}
              onPress={() => toggle(item.id)}
            />
          </Animated.View>
        );
      }}
    />
  );
}

const SPACING = 8;

function TabBar({
  active,
  onSwitch,
}: {
  active: "lote" | "centro";
  onSwitch: (t: "lote" | "centro") => void;
}) {
  // 1. Estado para el ancho total del contenedor de tabs
  const [containerWidth, setContainerWidth] = useState(0);
  const anim = useSharedValue(active === "lote" ? 0 : 1);

  useEffect(() => {
    anim.value = withTiming(active === "lote" ? 0 : 1, { duration: 300 });
  }, [active, anim]);

  // 2. Estilo animado de la línea
  const indicatorStyle = useAnimatedStyle(() => ({
    width: 100,
    transform: [{ translateX: anim.value * containerWidth + SPACING }],
  }));

  // 3. Capturar ancho al renderizar
  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabs}>
        {(["lote", "centro"] as const).map((t) => (
          <Pressable
            key={t}
            style={styles.tab}
            onPress={() => onSwitch(t)}
            onLayout={onLayout}
          >
            <Text
              style={active === t ? styles.tabLabelActive : styles.tabLabel}
            >
              {t === "lote" ? "Lote" : "Centro"}
            </Text>
          </Pressable>
        ))}
      </View>
      {/* 4. Línea absoluta bajo las tabs */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />
    </View>
  );
}
// Botón continuar
function ContinueButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.continueBtn} onPress={onPress}>
      <Text style={styles.continueText}>Continuar</Text>
    </Pressable>
  );
}

function SearchInputFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <View style={styles.searchInputContainer}>
      <TextInput
        value={value}
        placeholder="Busca..."
        style={styles.searchInput}
        onChangeText={onChange}
      />

      <View style={styles.iconContainer}>
        <AppIcon.Search size={28} strokeWidth={2} color="#777777" />
      </View>
    </View>
  );
}

// ==== Componente Principal ====
export default function SelectionTabsFilter({ onContinue }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<"lote" | "centro">("lote");

  // debounce
  const [debounced, setDebounced] = useState(searchText);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    // Limpiar el timeout anterior
    if (ref.current) clearTimeout(ref.current);

    // Crear un nuevo timeout
    ref.current = setTimeout(() => setDebounced(searchText), 300);

    // Limpiar el timeout al desmontar el componente
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, [searchText]);

  // fetch
  useEffect(() => {
    setLoading(true);
    fetchItems(activeTab, debounced)
      .then((res) => {
        console.log("Items recibidos:", res);
        setItems(res);
      })
      .finally(() => setLoading(false));
  }, [activeTab, debounced]);

  // form
  const { watch, setValue, handleSubmit } = useForm<FormValues>({
    defaultValues: { selectedItems: [] },
  });
  const selected = watch("selectedItems");
  const toggleSelect = (id: string) =>
    setValue(
      "selectedItems",
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  const onPress = handleSubmit(({ selectedItems }) =>
    onContinue(selectedItems),
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <TabBar active={activeTab} onSwitch={setActiveTab} />

      {/* Search Bar */}
      <SearchInputFilter value={searchText} onChange={setSearchText} />

      {/* Data list */}
      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <ItemsGrid items={items} selected={selected} toggle={toggleSelect} />
      )}

      {/* Continue Button */}
      <AppButton
        color="primary"
        size="lg"
        title="Continuar"
        onPress={onPress}
        style={styles.continueBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING * 2 },
  // pestañas
  tabContainer: {
    position: "relative", // para que indicator absolute se mida respecto a este
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: SPACING,
  },
  tab: { flex: 1, paddingVertical: SPACING, alignItems: "center" },
  tabLabel: { color: "#666", fontSize: 16 },
  tabLabelActive: { color: "#e94f1c", fontWeight: "bold", fontSize: 16 },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 4,
    left: 50 - SPACING / 2,
    backgroundColor: "#227c26",
  },
  // loader
  loader: { flex: 1, marginTop: SPACING * 2 },
  // cards
  card: {
    flex: 1,
    backgroundColor: "#afb0b1",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardSelected: { backgroundColor: "#92B516" },
  cardText: { color: "#ffffff", fontSize: 30, fontWeight: "bold" },
  // botón continuar
  continueBtn: {
    marginTop: 15,
  },
  continueText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchInput: {
    height: 50,
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 15,
    paddingLeft: 15,
    paddingRight: 40,
    backgroundColor: "#fff",
    fontSize: 16,
    fontFamily: "Montserrat",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginVertical: 15,
  },
  iconContainer: {
    position: "absolute",
    right: 15,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
  },
});
