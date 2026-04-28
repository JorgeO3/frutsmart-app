import React from "react";
import {
  View,
  Platform,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { IconUser } from "@tabler/icons-react-native";
import { useForm, type Control } from "react-hook-form";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAppActions } from "@stores/appStore";
import { FONT_FAMILTY } from "@src/constants/Font";
import { normalizeFont, scale } from "@utils/responsive";
import { sessionService } from "@services/session/SessionService";

import AppView from "@components/AppView";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import DebugWrapper from "@components/DebugScreenWrapper";
import { FormStyles } from "@components/FormControl/FormStyles";
import { PasswordControl } from "@components/FormControl/PasswordControl";
import { TextInputControl } from "@components/FormControl/TextInputControl";
import { useIntroStepProgressActions } from "@/src/stores/introStepProgress";

type LoginFormControl = Control<LoginFormData>;

interface LoginFormData {
  username: string;
  password: string;
}

const DEFAULT_FORM_VALUES: LoginFormData = {
  username: "",
  password: "",
};

const LoginScreen = () => {
  const router = useRouter();
  const { setSessionId } = useAppActions();
  const { resetProgress: resetIntroProgress } = useIntroStepProgressActions();
  const { control, handleSubmit } = useForm<LoginFormData>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      console.log("Iniciando sesión en la base de datos...");
      const newSession = await sessionService.startNewSession();
      console.log("Sesión creada exitosamente en la base de datos.");

      setSessionId(newSession.id);

      // Reiniciar el progreso de introducción al iniciar sesión
      resetIntroProgress();

      // 4. Navegar a la siguiente pantalla después de que la sesión se haya creado.
      router.replace("/auth/login-loading");
      console.log("Datos de login enviados:", data);
    } catch (error) {
      console.error("Fallo al iniciar la sesión en el login:", error);
      // Aquí podrías mostrar una alerta al usuario.
      alert("Error al iniciar la sesión. Por favor, inténtelo de nuevo.");
    }
  };

  const keyboardVerticalOffset = Platform.select({
    ios: 0, // Con ScrollView + flexGrow y justifyContent, a veces no se necesita tanto offset o se maneja con padding interno
    android: 20, // Un pequeño offset para Android si es necesario con 'height'
  });

  return (
    <DebugWrapper>
      <AppView style={styles.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.inner}>
          <AppImage
            source={require("@/assets/images/white-brand-slogan.svg")}
            style={{
              height: scale(90),
              width: scale(338.7),
              marginTop: scale(20),
            }}
            alt="Login"
          />

          <KeyboardAvoidingView
            behavior="padding"
            style={styles.formContainer}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            <ScrollView
              contentContainerStyle={styles.formInnerContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FormSection
                control={control}
                onSubmit={handleSubmit(onSubmit)}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </AppView>
    </DebugWrapper>
  );
};

interface FormSectionProps {
  control: LoginFormControl;
  onSubmit: () => void;
}

const FormSection = ({ control, onSubmit }: FormSectionProps) => (
  <View style={styles.formInner}>
    <View style={styles.inputContainer}>
      <TextInputControl
        label="Nombre de usuario"
        name="username"
        control={control}
        placeholder="Andres.Arango"
        rules={{ required: true }}
        labelStyle={styles.inputLabel}
        icon={
          <IconUser size={FormStyles.ICON_SIZE} color={FormStyles.ICON_COLOR} />
        }
        errorStyle={{ color: "#ff9e80" }}
      />

      <PasswordControl
        label="Contraseña"
        name="password"
        control={control}
        placeholder="********"
        rules={{ required: true }}
        labelStyle={styles.inputLabel}
        errorStyle={{ color: "#ff9e80" }}
      />
    </View>

    <AppButton title="Ingresa" color="primary" onPress={onSubmit} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#227c26",
  },
  inner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  formContainer: {
    flex: 1,
    width: "100%",
  },
  formInnerContainer: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: scale(20),
    paddingBottom: scale(20),
    gap: scale(20),
  },
  formInner: {
    width: "100%",
    gap: scale(20),
  },
  inputContainer: {
    gap: scale(20),
  },
  inputLabel: {
    color: "white",
    fontSize: normalizeFont(18),
    fontFamily: FONT_FAMILTY,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 10,
    fontSize: normalizeFont(18),
    fontFamily: FONT_FAMILTY,
    height: scale(50),
    padding: scale(10),
  },
});

export default LoginScreen;
