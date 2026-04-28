import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import Animated, { FadeInDown } from "react-native-reanimated";

import * as authService from "@services/auth/authService";
import { sessionService } from "@services/session/SessionService";
import { FONT_FAMILTY } from "@src/constants/font";
import { useAppActions } from "@stores/appStore";
import { font, s } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppView from "@components/AppView";
import LoginPasswordInput from "@components/app/auth/login/LoginPasswordInput";
import LoginTextInput from "@components/app/auth/login/LoginTextInput";
import { useIntroStepProgressActions } from "@stores/introStepProgress";
import { useResetNavigation } from "src/hooks/useResetNavigation";

const LoginScreen = () => {
  const navigate = useResetNavigation();
  const { setSessionId } = useAppActions();
  const { resetProgress } = useIntroStepProgressActions();

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = async (): Promise<void> => {
    if (submitting) return;

    // Resetear errores previos
    setUsernameError(null);
    setPasswordError(null);

    // Validación local de UI (aunque las credenciales reales las maneja el IdP)
    if (!username.trim()) {
      setUsernameError("El nombre de usuario es requerido.");
      return;
    }
    if (!password.trim()) {
      setPasswordError("La contraseña es requerida.");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Login contra OIDC / EasyAuth (gateway o Azure real)
      //    Esto debe abrir el navegador, hacer PKCE, guardar tokens,
      //    y notificar a Skybolt vía setAuthTokens internamente.
      console.log("[Login] Iniciando flujo de autenticación OIDC…");
      await authService.signInInteractive();
      console.log("[Login] Autenticación OIDC completada.");

      // 2) Crear la sesión en tu backend (ya con Authorization funcionando)
      console.log("[Login] Creando sesión en el backend…");
      const newSession = await sessionService.startNewSession();
      console.log("[Login] Sesión creada exitosamente:", newSession.id);

      setSessionId(newSession.id);

      // 3) Navegar al siguiente flujo (pantalla de loading / sync inicial)
      navigate("/auth/login-loading");
      console.log("[Login] Navegando a /auth/login-loading");
    } catch (error) {
      console.error("[Login] Fallo en login o creación de sesión:", error);
      Alert.alert(
        "Error",
        "No se pudo iniciar sesión. Por favor, inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
      resetProgress();
    }
  };

  const keyboardVerticalOffset = Platform.select({ ios: 0, android: 20 });

  return (
    <AppView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.inner}>
        <AppImage
          source={require("@/assets/images/white-brand-slogan.svg")}
          style={{ height: s(90), width: s(338.7), marginTop: s(20) }}
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
            <View style={styles.formInner}>
              <View style={styles.inputContainer}>
                <LoginTextInput
                  label="Nombre de usuario"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Juan.Osorio3"
                  error={usernameError}
                  labelStyle={styles.inputLabel}
                  errorStyle={{ color: "#ff9e80" }}
                  editable={!submitting}
                />

                <LoginPasswordInput
                  label="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="********"
                  error={passwordError}
                  labelStyle={styles.inputLabel}
                  errorStyle={{ color: "#ff9e80" }}
                  editable={!submitting}
                />
              </View>

              <AppButton
                title={submitting ? "Ingresando..." : "Ingresa"}
                color="primary"
                onPress={onSubmit}
                disabled={submitting}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </AppView>
  );
};

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
    paddingHorizontal: s(20),
    paddingBottom: s(20),
    gap: s(20),
  },
  formInner: {
    width: "100%",
    gap: s(20),
  },
  inputContainer: {
    gap: s(20),
    marginBottom: s(10),
  },
  inputLabel: {
    color: "white",
    fontSize: font.scale(18),
    fontFamily: FONT_FAMILTY,
  },
});

export default LoginScreen;
