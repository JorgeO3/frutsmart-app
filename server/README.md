# FrutSmart API Backend

Backend API para FrutSmart desarrollado con NestJS, TypeORM, PostgreSQL, y Fastify.

## 🚀 Características

- **NestJS 11+** con arquitectura modular
- **Fastify** como servidor HTTP (más rápido que Express)
- **SWC** para compilación ultra-rápida
- **TypeORM** para manejo de base de datos
- **PostgreSQL** como base de datos principal
- **Docker Compose** para desarrollo local
- **Swagger/OpenAPI** para documentación automática
- **Health Checks** integrados
- **Validación de variables de entorno**
- **CORS configurado** para desarrollo y producción
- **Rate limiting** y medidas de seguridad

## 📋 Prerrequisitos

- [Bun](https://bun.sh/) >= 1.0.0
- [Docker](https://docker.com/) y [Docker Compose](https://docs.docker.com/compose/)
- [Just](https://github.com/casey/just) (task runner)

## 🛠️ Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd frutsmart-back
```

### 2. Instalar dependencias

```bash
# Con just (recomendado)
just install

# O directamente con bun
bun install
```

### 3. Configurar variables de entorno

```bash
# Copiar archivo de configuración local
just setup

# O manualmente
cp .env.local.example .env.local
```

Edita `.env.local` con tu configuración específica.

### 4. Iniciar base de datos

```bash
# Iniciar PostgreSQL y Redis con Docker
just db-up

# Ver logs de la base de datos
just db-logs
```

### 5. Iniciar aplicación

```bash
# Modo desarrollo (con watch)
just dev

# O directamente
bun run start:dev
```

La aplicación estará disponible en:
- **API**: http://localhost:3000
- **Documentación Swagger**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **Adminer (DB Admin)**: http://localhost:8080

## 📁 Estructura del Proyecto

```
src/
├── config/             # Configuraciones de la aplicación
│   ├── app.config.ts
│   ├── cors.config.ts
│   ├── database.config.ts
│   └── env.validation.ts
├── database/           # Configuración de TypeORM
│   └── data-source.ts
├── entities/           # Entidades de base de datos
│   └── user.entity.ts
├── health/             # Health checks
│   ├── health.controller.ts
│   └── health.module.ts
├── modules/            # Módulos globales
│   └── global.module.ts
├── migrations/         # Migraciones de base de datos
├── app.module.ts       # Módulo principal
├── main.ts            # Bootstrap de la aplicación
└── ...
```

## 🔧 Comandos Disponibles (Just)

### Desarrollo
```bash
just dev              # Iniciar servidor de desarrollo
just build             # Compilar aplicación
just start             # Iniciar servidor de producción
```

### Base de Datos
```bash
just db-up             # Iniciar servicios de DB
just db-down           # Parar servicios de DB
just db-reset          # Resetear base de datos (⚠️ elimina datos)
just db-connect        # Conectar a la DB con psql
just db-backup         # Crear backup de la DB
```

### Migraciones
```bash
just migration-generate <name>    # Generar migración
just migration-create <name>      # Crear migración vacía
just migration-run               # Ejecutar migraciones
just migration-revert            # Revertir última migración
just migration-show              # Ver estado de migraciones
```

### Testing y Calidad
```bash
just test              # Ejecutar tests unitarios
just test-e2e          # Ejecutar tests e2e
just test-cov          # Tests con coverage
just lint              # Linter
just lint-fix          # Fix linting automático
just format            # Formatear código
just type-check        # Verificar tipos TypeScript
just check             # Ejecutar todas las verificaciones
```

### Docker y Producción
```bash
just up                # Iniciar todos los servicios
just down              # Parar todos los servicios
just logs              # Ver logs de todos los servicios
just restart           # Reiniciar servicios
```

### Utilidades
```bash
just clean             # Limpiar build artifacts
just health            # Verificar salud de la aplicación
just env-info          # Ver información del entorno
```

## 🗃️ Base de Datos

### Configuración Local (Docker)

El proyecto incluye un `docker-compose.yml` con:
- **PostgreSQL 16**: Base de datos principal
- **Redis 7**: Cache (opcional)
- **Adminer**: Interfaz web para administrar la DB

### Credenciales por Defecto (Desarrollo)
```
Host: localhost
Port: 5432
Database: frutsmart_dev
Username: frutsmart_user
Password: frutsmart_password
```

### Migraciones

```bash
# Generar migración automática basada en cambios de entidades
just migration-generate AddUserTable

# Crear migración manual
just migration-create UpdateUserFields

# Ejecutar migraciones pendientes
just migration-run

# Ver estado
just migration-show
```

## 🌍 Ambientes

### Desarrollo
- Archivo: `.env.local` (gitignored)
- Database: Docker local
- Logging: habilitado
- Synchronize: true (para desarrollo rápido)

### Producción
- Archivo: `.env.production`
- Database: Externa (configurar DATABASE_URL)
- Logging: solo errores
- Synchronize: false (usar migraciones)

## 📚 API Documentation

La documentación de la API está disponible en `/docs` cuando la aplicación está ejecutándose.

### Endpoints Principales

- `GET /health` - Health check general
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## 🔒 Seguridad

- **Rate limiting**: 100 requests por minuto por defecto
- **CORS**: Configurado para dominios específicos
- **Helmet**: Headers de seguridad automáticos
- **Validation**: Validación automática de DTOs
- **Environment validation**: Validación de variables de entorno

## 🐛 Debugging

### Logs
```bash
# Ver logs en tiempo real
just logs

# Logs específicos de la aplicación
just dev  # Los logs aparecen en la consola
```

### Base de Datos
```bash
# Conectar directamente a PostgreSQL
just db-connect

# Ver logs de la base de datos
just db-logs

# Administrar via web
# Ir a http://localhost:8080 (Adminer)
```

## 📦 Deployment

### Docker Production
```bash
# Construir imagen de producción
docker build -t frutsmart-api .

# Ejecutar con variables de entorno
docker run -p 3000:3000 --env-file .env.production frutsmart-api
```

### Variables de Entorno Requeridas (Producción)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-super-secret-key
CORS_ORIGINS=https://your-domain.com
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📝 License

Este proyecto está bajo la licencia [MIT](LICENSE).

## 🆘 Soporte

Para reportar bugs o solicitar features, por favor crear un [issue](https://github.com/your-repo/issues).

## 🔄 Changelog

### v1.0.0
- ✅ Setup inicial con NestJS + Fastify + SWC
- ✅ Configuración de TypeORM + PostgreSQL
- ✅ Docker Compose para desarrollo
- ✅ Health checks integrados
- ✅ Validación de variables de entorno
- ✅ Documentación Swagger
- ✅ Justfile con comandos de desarrollo
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
