import { useState, useCallback, useEffect, useRef } from "react";

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { tempFileManager } from "@services/temp-file-manager/TempFileManager";

export type TakePhotoOptions = Partial<ImagePicker.ImagePickerOptions>;
export type PhotoResult = { uri: string; height: number; width: number };

// Constantes
const PERMISSION_DENIED_ERROR = "Permiso denegado para usar la cámara";
const DEFAULT_CAMERA_OPTIONS: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  quality: 1,
  aspect: [1, 1],
};

// Utilidades separadas
const isImagePickerError = (
  result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult
): result is ImagePicker.ImagePickerErrorResult => {
  return "code" in result;
};

const isValidImageResult = (result: ImagePicker.ImagePickerResult): boolean => {
  return !result.canceled && !!result.assets?.[0]?.uri;
};

const moveImageToTempDirectory = async (sourceUri: string): Promise<string> => {
  const destinationUri = tempFileManager.getNewTempFileUri(".jpg");
  console.log(`Moviendo imagen de caché a directorio temporal: ${destinationUri}`);

  await FileSystem.moveAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
};

const processImageAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<PhotoResult> => {
  const newUri = await moveImageToTempDirectory(asset.uri);

  return {
    uri: newUri,
    width: asset.width,
    height: asset.height,
  };
};

const handleImagePickerResult = async (
  result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult,
): Promise<PhotoResult | null> => {
  if (isImagePickerError(result)) {
    throw new Error(result.message);
  }

  if (!isValidImageResult(result) || !result.assets) {
    return null;
  }

  const asset = result.assets[0];
  return await processImageAsset(asset);
};

const requestCameraPermission = async (): Promise<void> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(PERMISSION_DENIED_ERROR);
  }
};

const processPendingResult = async (): Promise<PhotoResult | null> => {
  const rawResult = await ImagePicker.getPendingResultAsync();
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;

  if (!result) return null;

  return await handleImagePickerResult(result);
};

export const useTakePhoto = (options: TakePhotoOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const isComponentMounted = useRef(true);

  // Procesar resultado pendiente al montar
  useEffect(() => {
    const handlePendingResult = async () => {
      try {
        const pendingPhoto = await processPendingResult();

        if (isComponentMounted.current && pendingPhoto) {
          setPhoto(pendingPhoto);
        }
      } catch (e) {
        if (isComponentMounted.current) {
          setError(e as Error);
        }
      }
    };

    handlePendingResult();

    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  const takePhoto = useCallback(async (): Promise<PhotoResult | null> => {
    setLoading(true);
    setError(null);

    try {
      await requestCameraPermission();

      const cameraOptions = { ...DEFAULT_CAMERA_OPTIONS, ...options };
      const result = await ImagePicker.launchCameraAsync(cameraOptions);

      const processedPhoto = await handleImagePickerResult(result);

      if (processedPhoto) {
        setPhoto(processedPhoto);
      }

      return processedPhoto;
    } catch (e) {
      setError(e as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  return {
    takePhoto,
    loading,
    error,
    photo
  };
};