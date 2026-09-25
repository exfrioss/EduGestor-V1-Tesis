# Decisiones de arquitectura

## CUR-API-01 — Administración curricular y correspondencias

**Estado:** implementado y validado. **Fecha:** 25/09/2026. **Tipo:** precisión técnica del alcance V1.0, sin RF/RNF nuevos. No renumera ni reabre D-01 a D-07. Fuente normativa: REQUIREMENTS.md revisión 4 y DATABASE.md actualizado. Contratos completos: [API.md](API.md), sección “Contratos aprobados — Administración curricular”.

### Decisión de permisos

El catálogo conserva los 13 códigos originales y añade estos cuatro códigos recurso.acción, en singular y kebab-case:

| Código | Semántica |
|---|---|
| curriculum-catalog.read | Leer referencias compartidas desde un contexto autorizado. |
| curriculum-catalog.manage | Administrar catálogo compartido solo mediante autorización técnica excepcional. |
| subject-curriculum-mapping.read | Leer correspondencias dentro del ámbito institucional/curso permitido. |
| subject-curriculum-mapping.manage | Crear, retirar y sustituir correspondencias institucionales autorizadas. |

Los códigos están implementados en TypeScript y el bootstrap sincroniza 17 códigos/descripciones sin autorizar concesiones automáticas. El dataset demo usa una lista explícita de los 13 permisos anteriores. No usar el plural subject-curriculum-mappings para permisos (las rutas REST sí son plurales). manage no implica read; subject.manage no implica administración curricular.

### Catálogo compartido y límites de autorización

AccessScope pertenece a una institución. Ninguna concesión institucional autoriza una escritura global. La administración compartida requiere TECHNICAL, autorización explícita de acción excepcional, technicalReason, sesión, CSRF y auditoría. No se crea GLOBAL ni institución artificial; tampoco se permite delegar curriculum-catalog.manage por /authorization/grants ordinario. El código de permiso no sustituye la política técnica.

La implementación exige una concesión raíz explícita del permiso a la propia cuenta técnica, activa y con cadena efectiva. Una cuenta `TECHNICAL` sin esa concesión y un administrador ordinario al que se hubiese asignado el código son rechazados. El endpoint genérico de comprobación aplica la misma política y la delegación ordinaria rechaza el permiso.

RESOURCE_SET permanece no soportado. La escritura de correspondencias exige scope institucional completo; una concesión de curso permite solo lectura contextual autorizada. No puede alterar una correspondencia compartida por otras secciones/años. La futura autorización por Subject explícito del modelo no se implementa incidentalmente aquí.

### Modelo, historia y concurrencia

Subject es institucional y genérico. PlanType, AcademicArea y CurriculumDiscipline son compartidos; planTypeId es obligatorio y academicAreaId nullable. El área existente pertenece al mismo plan. No inventar áreas. Una correspondencia Subject + btiYear + disciplina puede existir sin malla. AcademicYear sigue distinto de btiYear.

Se mantiene una correspondencia vigente por materia/nivel. La sustitución retira la anterior y crea otra fila en una transacción con control de versión, unicidad parcial y auditoría. Retiro/reemplazo no borran historia ni cambian identidades. Correcciones que reinterpretarían clasificación usada se rechazan. Las futuras referencias AnnualPlan conservan su correspondencia y Curriculum concretos; no se exige crear esos modelos ahora.

### Contratos y compatibilidad HTTP

API.md define 13 rutas: tres lecturas de catálogo, seis escrituras excepcionales y cuatro operaciones de correspondencias. Se reutilizan AUTHENTICATION_REQUIRED, PERMISSION_DENIED, CSRF_TOKEN_INVALID, VALIDATION_ERROR y el formato error.requestId ya implementados. Los códigos específicos nuevos se documentan solo para las rutas nuevas; no se cambian los contratos del Hito 1.

### Disponibilidad de malla y UX

curriculumAvailability es contrato futuro. En este checkpoint se omite y la UI expresa disponibilidad aún no consultable. No implementar Curriculum/capacidades/contenidos/indicadores ni inventar filas o respuestas. Cuando exista fuente real se distinguirán NOT_AVAILABLE y VALIDATED_AVAILABLE por disciplina/nivel exactos.

Se conserva Inicio → Institución → Curso → Materia → espacio de trabajo. Crear materia no exige referencia. Conducta identifica comportamiento, Disciplina curricular la clasificación oficial. La asociación sin área es válida; no exige malla. Los estados definitivos de disponibilidad se habilitan cuando puedan comprobarse. La administración técnica no se convierte en trabajo cotidiano.

### Consecuencias y verificación

Hito 1 mantiene sus 16 entidades y recorrido, sin nuevas dependencias obligatorias. La estructura curricular ya implementada se reutiliza y no se repite la migración. La implementación no modificó REQUIREMENTS.md, DATABASE.md ni PROJECT_MASTER.md. La evidencia ejecutada se registra en [TESTS.md](../tests/TESTS.md).
