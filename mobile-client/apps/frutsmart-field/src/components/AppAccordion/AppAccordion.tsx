import { View, StyleSheet } from "react-native";

import AppAccordionItem from "./AppAccordionItem";

interface AccordionProps {
  data: {
    title: string;
    content: React.ReactNode;
  }[];
  expandMultiple?: boolean;
}

const AppAccordion: React.FC<AccordionProps> = ({
  data,
  expandMultiple = false,
}) => {
  return (
    <View style={styles.accordionContainer}>
      {data.map((item, index) => (
        <AppAccordionItem
          title={item.title}
          key={`accordion-item-${item.title}`}
          isInitiallyExpanded={expandMultiple || index === 0}
        >
          {item.content}
        </AppAccordionItem>
      ))}
    </View>
  );
};

export default AppAccordion;

const styles = StyleSheet.create({
  accordionContainer: {
    width: "100%",
  },
});
