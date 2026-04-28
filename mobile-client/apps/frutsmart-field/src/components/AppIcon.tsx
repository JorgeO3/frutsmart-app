import type { ForwardRefExoticComponent } from "react";

import {
  IconDotsVertical,
  IconInfoCircle,
  IconAlertCircle,
  IconCircleCheck,
  IconArrowLeft,
  IconSearch,
  IconPhoto,
  IconDownload,
} from "@tabler/icons-react-native";
import type { SvgProps } from "react-native-svg";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Feather from "@expo/vector-icons/Feather";

interface IconProps extends SvgProps {
  size?: number;
  strokeWidth?: string | number;
  title?: string;
}

export type Icon = ForwardRefExoticComponent<IconProps>;

const ZoomOutMap = (props: IconProps) => (
  <MaterialIcons
    name="zoom-out-map"
    size={props.size || 24}
    color={props.color || "black"}
  />
);

const Close = (props: IconProps) => (
  <MaterialIcons
    name="close"
    size={props.size || 24}
    color={props.color || "black"}
  />
);

const Download = (props: IconProps) => (
  <Feather
    name="download"
    size={props.size || 24}
    color={props.color || "black"}
  />
);

const Calendar = (props: IconProps) => (
  <Feather
    name="calendar"
    size={props.size || 24}
    color={props.color || "black"}
  />
);

const PdfIcon = (props: IconProps) => (
  <FontAwesome6
    name="file-pdf"
    size={props.size || 24}
    color={props.color || "black"}
  />
);

const Check = (props: IconProps) => (
  <FontAwesome6
    name="check"
    size={props.size || 24}
    color={props.color || "black"}
    strokeWidth={props.strokeWidth || "2"}
  />
);

const CloudUpload = (props: IconProps) => (
  <FontAwesome6
    name="arrow-up-from-bracket"
    size={props.size || 24}
    color={props.color || "black"}
    strokeWidth={1}
  />
);

const User = (props: IconProps) => (
  <Feather
    name="user"
    size={props.size || 24}
    color={props.color || "black"}
    strokeWidth={props.strokeWidth || "2"}
  />
);

const ChartPie = (props: IconProps) => (
  <Feather
    name="pie-chart"
    size={props.size || 24}
    color={props.color || "black"}
    strokeWidth={props.strokeWidth || "2"}
  />
);

const Logout = (props: IconProps) => (
  <Feather
    name="log-out"
    size={props.size || 24}
    color={props.color || "black"}
    strokeWidth={props.strokeWidth || "2"}
  />
);

const AppIcon = {
  ArrowLeft: IconArrowLeft,
  DotsVertical: IconDotsVertical,
  InfoCircle: IconInfoCircle,
  AlertCircle: IconAlertCircle,
  CircleCheck: IconCircleCheck,
  Search: IconSearch,
  Photo: IconPhoto,
  Download,
  TriangleWarning: AntDesign,
  ZoomOutMap,
  Close,
  Calendar,
  PdfIcon,
  Check,
  CloudUpload,
  User,
  ChartPie,
  Logout,
};

export default AppIcon;
