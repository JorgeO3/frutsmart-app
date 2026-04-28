import type React from "react";
import CameraContainer, { type PhotoData } from "./CameraContainer";

interface Props {
  onPhotoCaptured: (photoData: PhotoData) => void;
}

const CameraCaptureScreen = ({ onPhotoCaptured }: Props) => {
  return <CameraContainer onPhotoCaptured={onPhotoCaptured} />;
};

export default CameraCaptureScreen;
