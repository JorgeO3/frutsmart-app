# Makefile para Builds de React Native Android (Expo)

# --- Variables de Configuración ---
# Usa ':=' para expansión simple, similar a Justfile
ANDROID_DIR := android
GRADLEW := $(ANDROID_DIR)/./gradlew
METRO_PID_FILE := .metro.pid # Archivo para guardar el PID del proceso Metro

# Arquitecturas (ABIs) - Ajusta según tus necesidades
PROD_ABIS := armeabi-v7a,arm64-v8a
DEV_ABI_DEFAULT := arm64-v8a # Cambia a "x86_64" si usas principalmente emulador x86_64
DEV_ABI_ARM64 := arm64-v8a
DEV_ABI_X86_64 := x86_64

# Build Variant para Producción/Preview (usualmente 'Release')
RELEASE_VARIANT := Release # Cambia si usas flavors (e.g., 'prodRelease', 'stagingRelease')
# Build Variant para Desarrollo (usualmente 'debug')
DEBUG_VARIANT := Debug   # Cambia si usas flavors (e.g., 'devDebug')

# --- Target por Defecto ---
.DEFAULT_GOAL := help # Mostrar ayuda si solo se ejecuta 'make'

# --- Targets Principales (Interfaz para el desarrollador) ---

dev: start-metro ## Desarrollo con ABI por defecto ($(DEV_ABI_DEFAULT)) y Hot Reload
	@echo "Iniciando build de desarrollo para ABI: $(DEV_ABI_DEFAULT)..."
	@$(MAKE) build-install-dev ABI=$(DEV_ABI_DEFAULT)

dev-arm64: start-metro ## Desarrollo para ARM64 con Hot Reload
	@echo "Iniciando build de desarrollo para ABI: $(DEV_ABI_ARM64)..."
	@$(MAKE) build-install-dev ABI=$(DEV_ABI_ARM64)

dev-x86_64: start-metro ## Desarrollo para x86_64 (Emulador) con Hot Reload
	@echo "Iniciando build de desarrollo para ABI: $(DEV_ABI_X86_64)..."
	@$(MAKE) build-install-dev ABI=$(DEV_ABI_X86_64)

prev-build: start-metro build-assemble-preview ## Build Preview (artefacto Release, usa caché, ¿con Metro?)

# Descomenta si quieres una tarea para construir E INSTALAR preview
# prev: start-metro build-install-preview ## Build E INSTALA Preview (Opción B)

prod: prod-apk ## Build Producción (Default: APK limpio)

prod-apk: clean build-prod-apk-internal ## Build Producción APK (Limpio, sin caché)

prod-aab: clean build-prod-aab-internal ## Build Producción AAB (Limpio, sin caché)


# --- Targets Auxiliares (Implementación) ---

# Inicia el servidor Metro en segundo plano si no está corriendo
# OJO: La indentación DEBE ser con TABS, no espacios.
start-metro:
	@if ! test -f $(METRO_PID_FILE) || ! ps -p $$(cat $(METRO_PID_FILE)) > /dev/null; then \
		echo "Iniciando Metro Bundler en segundo plano..."; \
		bun run expo start & echo $$! > $(METRO_PID_FILE); \
		echo "Metro iniciado con PID $$(cat $(METRO_PID_FILE)). Esperando un momento..."; \
		sleep 5; \
	else \
		echo "Metro ya parece estar corriendo (PID $$(cat $(METRO_PID_FILE)))."; \
	fi

# Detiene el servidor Metro iniciado con start-metro
stop-metro:
	@if test -f $(METRO_PID_FILE); then \
		PID=$$(cat $(METRO_PID_FILE)); \
		echo "Intentando detener Metro (PID $$PID)..."; \
		if ps -p $$PID > /dev/null; then \
			kill $$PID; \
			rm $(METRO_PID_FILE); \
			echo "Metro detenido."; \
		else \
			echo "Proceso Metro (PID $$PID) no encontrado."; \
			rm $(METRO_PID_FILE); \
		fi; \
	else \
		echo "No se encontró el archivo PID de Metro ($(METRO_PID_FILE))."; \
	fi

# Construye e instala la variante de Debug (para Desarrollo)
# Espera que ABI se pase como argumento: make build-install-dev ABI=...
# Usa caché (debe estar habilitado globalmente en ~/.gradle/gradle.properties)
build-install-dev:
	@echo "Construyendo e instalando $(DEBUG_VARIANT) para ABI: $(ABI)..."
	cd $(ANDROID_DIR) && \
	./gradlew install$(DEBUG_VARIANT) -PreactNativeArchitectures=$(ABI) && \
	cd .. && \
	echo "Build $(DEBUG_VARIANT) instalado."

# Construye (pero no instala) la variante Release (para Preview con caché)
# Usa caché (habilitado globalmente)
build-assemble-preview:
	@echo "Construyendo artefacto Preview ($(RELEASE_VARIANT)) para ABIs: $(PROD_ABIS) (usando caché)..."
	cd $(ANDROID_DIR) && \
	./gradlew assemble$(RELEASE_VARIANT) -PreactNativeArchitectures=$(PROD_ABIS) && \
	cd .. && \
	echo "Build Preview completado (artefactos en $(ANDROID_DIR)/app/build/outputs/)."

# (Opcional) Construye E INSTALA la variante Release (Opción B para Preview)
# Usa caché (habilitado globalmente)
# build-install-preview:
#	@echo "Construyendo e instalando Preview ($(RELEASE_VARIANT)) para ABIs: $(PROD_ABIS) (usando caché)..."
#	cd $(ANDROID_DIR) && \
#	./gradlew install$(RELEASE_VARIANT) -PreactNativeArchitectures=$(PROD_ABIS) && \
#	cd .. && \
#	echo "Build Preview instalado."


# Target interno para construir APK de Producción (Limpio, sin caché)
# Se llama DESPUÉS de 'clean'
build-prod-apk-internal:
	@echo "Construyendo artefacto de Producción APK ($(RELEASE_VARIANT)) para ABIs: $(PROD_ABIS) (¡Build limpio!)..."
	cd $(ANDROID_DIR) && \
	./gradlew assemble$(RELEASE_VARIANT) --no-build-cache --rerun-tasks -PreactNativeArchitectures=$(PROD_ABIS) && \
	cd .. && \
	echo "Build de Producción APK completado (artefactos en $(ANDROID_DIR)/app/build/outputs/)."

# Target interno para construir AAB de Producción (Limpio, sin caché)
# Se llama DESPUÉS de 'clean'
build-prod-aab-internal:
	@echo "Construyendo artefacto de Producción AAB ($(RELEASE_VARIANT)) para ABIs: $(PROD_ABIS) (¡Build limpio!)..."
	cd $(ANDROID_DIR) && \
	./gradlew bundle$(RELEASE_VARIANT) --no-build-cache --rerun-tasks -PreactNativeArchitectures=$(PROD_ABIS) && \
	cd .. && \
	echo "Build de Producción AAB completado (artefactos en $(ANDROID_DIR)/app/build/outputs/)."

# Limpia los builds previos de Android
clean:
	@echo "Limpiando builds previos de Android..."
	cd $(ANDROID_DIR) && ./gradlew clean && cd .. && echo "Limpieza completada."


# --- Targets Misceláneos ---

# Declara targets que no son archivos para evitar conflictos y mejorar rendimiento
.PHONY: default dev dev-arm64 dev-x86_64 prev-build prev prod prod-apk prod-aab \
	start-metro stop-metro build-install-dev build-assemble-preview build-install-preview \
	build-prod-apk-internal build-prod-aab-internal clean help

# Target de Ayuda para mostrar comandos disponibles
help: ## Muestra esta ayuda
	@echo "Uso: make [target]"
	@echo ""
	@echo "Targets principales:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sed 's/\(.*\):.*##\(.*\)/\1##\2/' | awk 'BEGIN {FS = "##"}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "Notas:"
	@echo " - Asegúrate de tener optimizado ~/.gradle/gradle.properties (cache, parallel, jvmargs)."
	@echo " - Ajusta las variables (ABIs, Variants) al inicio de este Makefile si es necesario."
	@echo " - La indentación en las recetas DEBE ser con TABS."