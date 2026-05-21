import type { Href, Router } from "expo-router";
import { Alert } from "react-native";

// CAMBIO: Importamos NanoRTError para usarlo como nuestro tipo principal
import { NanoRTError } from "nano-rt";

// La estructura de datos que espera la pantalla de feedback
export interface DetectionErrorData {
  imgSrc: string;
  feedbackMessages: string[];
}

const MESSAGES = {
  GENERIC_ERROR: "Ocurrió un error inesperado. Por favor, vuelva a tomar la foto.",
} as const;

export class ErrorHandler {
  constructor(
    private router: Router,
    private imgUri: string,
    private feedbackScreenRoute: Href,
    private pictureScreenRoute: Href,
  ) { }

  // CAMBIO: El método handle ahora espera un error de tipo 'unknown'
  handle(error: unknown): void {
    // La lógica principal ahora es verificar si el error es una instancia de NanoRTError
    if (this.isNanoRTError(error) && error.isSegmentError()) {
      this.handleNanoRTSegmentError(error);
    } else {
      this.handleGenericError(error);
    }
  }

  // Narrowing helper: confirma si un valor unknown es NanoRTError
  private isNanoRTError(error: unknown): error is NanoRTError {
    return error instanceof NanoRTError;
  }

  // CAMBIO: Nuevo método específico para manejar los errores de segmentación de NanoRT
  private handleNanoRTSegmentError(error: NanoRTError): void {
    console.log("Manejando error de segmentación de NanoRT:", error.code);

    const data: DetectionErrorData = {
      imgSrc: this.imgUri,
      // Usamos los métodos de NanoRTError para obtener los mensajes correctos
      feedbackMessages: error.getGuidance(),
    };
    const stringifiedData = JSON.stringify(data);

    this.router.replace({
      // biome-ignore lint/suspicious/noExplicitAny: this is necessary because of the way expo-router handles routes
      pathname: this.feedbackScreenRoute as unknown as any,
      params: { data: stringifiedData },
    });
  }

  // CAMBIO: Un único manejador para todos los demás errores
  private handleGenericError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("Manejando error genérico:", errorMessage);

    Alert.alert(
      "Error",
      MESSAGES.GENERIC_ERROR,
      [
        {
          text: "Reintentar",
          onPress: () => this.router.replace(this.pictureScreenRoute),
        },
      ],
    );
  }
}