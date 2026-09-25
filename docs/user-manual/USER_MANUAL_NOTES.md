# EduGestor V1.0 — Notas del manual de usuario

## Recorrido del Hito 1

### Ingreso

1. Abrir `http://localhost:5173/login`.
2. Ingresar el usuario y la contraseña provistos por la institución.
3. EduGestor dirige la cuenta a Administración si posee una institución visible; en caso contrario, una cuenta docente abre “Mis asignaciones”.
4. “Cerrar sesión” revoca la sesión en el servidor. No se guarda ningún token en el navegador.

### Recorrido administrativo

1. En **Instituciones**, seleccionar **Administrar**. Una cuenta técnica puede crear la institución inicial con un motivo auditado; una cuenta administrativa ordinaria no ve esa excepción.
2. En **Docentes**, crear un perfil con cuenta nueva o vincular un UUID de usuario existente. La contraseña inicial debe tener al menos 12 caracteres y no vuelve a mostrarse.
3. En **Año y cursos**, crear el año lectivo, marcar el actual y luego crear el curso con grado, sección y turno.
4. En **Materias**, crear el catálogo institucional. La disciplina curricular es opcional.
5. En **Asignaciones**, elegir docente, curso y materia activos y seleccionar **Asignar docente**.
6. Las acciones de desactivar, desvincular o retirar siempre solicitan confirmación y conservan la historia.

### Área docente

“Mis asignaciones” muestra exclusivamente asignaciones vigentes de la cuenta autenticada. Cada tarjeta incluye institución, año lectivo, grado, sección, turno y materia. Una cuenta solo docente no ve navegación administrativa. Conocer un UUID ajeno no habilita su consulta.

### Mensajes habituales

- `401`: la sesión no existe o venció; volver a iniciar sesión.
- `403`: la cuenta no posee permiso y scope para la operación.
- `409`: existe un dato incompatible o duplicado.
- `422`: revisar los campos enviados.

## Demo automatizada con datos ficticios

Ejecutar desde la raíz:

```bash
npm install
npm run test:e2e
```

El recorrido usa únicamente estos datos simulados:

- administrador: `admin.demo` / `DemoAdmin-2026!`;
- docente: `docente.demo` / `DemoDocente-2026!`;
- institución: `Colegio Horizonte Demo`;
- año/curso: `2026`, `1.º BTI`, sección `A`, turno `Mañana`;
- materia: `Programación I`.

Estas credenciales solo existen dentro de la interceptación Playwright: no son secretos reales, no se insertan en PostgreSQL y no permiten ingresar a una instalación normal.

## Demo manual contra backend real

1. Copiar `.env.example` a `.env` y configurar valores locales sin versionar secretos.
2. Iniciar PostgreSQL/API/frontend con `docker compose up -d --build` o `npm run dev` si PostgreSQL ya está disponible.
3. Aplicar migraciones y catálogo según el manual técnico.
4. Utilizar una institución, concesión administrativa y cuenta de demostración previamente provisionadas por el mecanismo backend aprobado.
5. Abrir `/login` y repetir el recorrido administrativo anterior; cerrar sesión e ingresar con la cuenta docente creada.

Este checkpoint no incorpora un seeder backend de demostración. Por tanto, no hay credenciales reales predeterminadas y cualquier cuenta real debe suministrarse fuera del repositorio.
