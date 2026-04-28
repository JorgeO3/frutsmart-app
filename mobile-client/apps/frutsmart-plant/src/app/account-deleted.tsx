import PaymentCriteriaCard from "@components/PaymentCriteriaCard";
import { View } from "react-native";

export default function AccountDeleted() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <PaymentCriteriaCard
        criteria="ANA"
        explanation="Indica que al menos el 60% de los racimos están en clases de buena calidad (1 y 2) y que hay menos del 3% de racimos verdes, reflejando una cosecha bien aplicada y oportuna."
      />
    </View>
  );
}
