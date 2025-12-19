# Impulse API

Backend para la extensión Impulse Chrome Extension.

## Configuración

### Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
# ═══════════════════════════════════════════════════════════════════════════
# SERVER
# ═══════════════════════════════════════════════════════════════════════════
PORT=3000
NODE_ENV=development

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE (PostgreSQL)
# ═══════════════════════════════════════════════════════════════════════════
DATABASE_URL=postgres://usuario:password@host:5432/database

# ═══════════════════════════════════════════════════════════════════════════
# JWT (JSON Web Tokens)
# ═══════════════════════════════════════════════════════════════════════════
# Genera una clave secreta: openssl rand -base64 64
JWT_SECRET=CAMBIA_ESTO_POR_UNA_CLAVE_SECRETA_MUY_LARGA
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ═══════════════════════════════════════════════════════════════════════════
# CORS
# ═══════════════════════════════════════════════════════════════════════════
CORS_ORIGIN=chrome-extension://tu-extension-id
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Compilar
npm run build

# Ejecutar en producción
npm start
```

## Endpoints

### Auth
- `POST /api/auth/register` - Crear cuenta
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Sync (requiere auth)
- `GET /api/sync/settings` - Obtener settings
- `PUT /api/sync/settings` - Guardar settings
- `GET /api/sync/blocking-periods` - Obtener blocking periods
- `PUT /api/sync/blocking-periods` - Guardar blocking periods
- `GET /api/sync/impulse-controls` - Obtener impulse controls
- `PUT /api/sync/impulse-controls` - Guardar impulse controls

