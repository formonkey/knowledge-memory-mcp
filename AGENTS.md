# Agent Instructions

## Objetivo

Este workspace usa el MCP `changes_memory` para recordar correcciones, criterios y errores recurrentes entre conversaciones. Cualquier agente que implemente, revise o corrija trabajo debe consultar y aplicar esos criterios cuando sigan siendo pertinentes.

## Stores compartidos

La memoria persistente vive en un store unico con una memoria global y memorias por proyecto:

- `global/changes.md`: criterios transversales.
- `projects/<project-key>/changes.md`: criterios especificos de un proyecto.

Los agentes no deben editar esos ficheros manualmente. La interaccion debe hacerse a traves del MCP `changes_memory`.

## Uso obligatorio del MCP `changes_memory`

Antes de implementar, revisar o corregir codigo:

- Llama a `get_relevant_changes` con un resumen breve y concreto de la tarea.
- Si necesitas buscar una preferencia, error recurrente, ruta o concepto concreto, usa `search_changes`.
- Si ya conoces el identificador exacto de un cambio, usa `get_change`.
- Cuando trabajes con varios proyectos en una conversacion, pasa `projectPath`, `projectKey` o `project` para seleccionar el proyecto correcto.

Cuando el usuario corrija un patron, una decision recurrente o un criterio reutilizable:

- No llames a `add_change` por iniciativa propia.
- Solo guarda un aprendizaje si el usuario lo pide explicitamente.
- El guardado debe hacerse despues de la correccion, no antes.
- No guardes detalles pasajeros o ruido de una tarea aislada.
- Guarda solo cambios que puedan evitar futuros errores o mejorar la consistencia entre conversaciones.

## Politica de guardado con validacion del usuario

Flujo obligatorio antes de `add_change` o `add_change_global`:

1. El agente termina la correccion o recopila los ultimos cambios relevantes.
2. El agente prepara una propuesta breve de lo que entiende que deberia guardarse.
3. El agente pide validacion explicita del usuario.
4. Solo si el usuario confirma, llama a `add_change` para memoria de proyecto o `add_change_global` para memoria transversal.

El agente no debe interpretar una correccion como permiso implicito para persistirla.

## Como registrar un cambio

Usa `add_change` para criterios especificos del proyecto actual. Usa `add_change_global` solo cuando el criterio sea claramente reutilizable entre proyectos.

Rellena los campos de forma clara y reutilizable:

- `title`: criterio corto y directo.
- `summary`: contexto del error, correccion o preferencia detectada.
- `requestedChange`: comportamiento esperado a partir de ahora.
- `rationale`: motivo por el que debe aplicarse.
- `kind`: usa `preference`, `repo-convention`, `domain-fact` o `anti-pattern`.
- `scope`: `add_change` usa scope de proyecto; `add_change_global` usa scope global.
- `tags`, `relatedPaths`, `before`, `after` y `examples`: completalos cuando ayuden a recuperar y aplicar mejor el cambio.

## Referencia a correcciones recientes

Cuando sea util referirse a varias correcciones recientes en un prompt, el agente debe usar referencias cortas, legibles y estables dentro de la conversacion, por ejemplo:

- `fix-a1`
- `fix-b2`
- `fix-c3`

No uses hashes opacos o largos si no son necesarios. La referencia corta solo sirve para que el usuario indique que correcciones quiere convertir en memoria; antes de llamar a `add_change`, el agente debe reconstruir la propuesta en lenguaje claro y pedir confirmacion.

Ejemplo de uso:

- `Guarda en memoria fix-a1 y fix-c3`
- `Prepara add_change con fix-b2, pero ensenamelo antes`

## Flujo recomendado entre agentes

Flujo por defecto:

1. El agente implementador consulta `get_relevant_changes` antes de tocar codigo.
2. El agente implementador realiza el trabajo intentando respetar esos criterios.
3. El agente de review revisa el codigo y contrasta el resultado con los cambios recuperados y con los criterios ya aprendidos.
4. Si el review detecta incumplimientos o una nueva correccion reutilizable, lo comunica al agente implementador.
5. Si aparece un aprendizaje nuevo y generalizable, el agente puede proponer guardarlo, pero solo se registra con `add_change` o `add_change_global` si el usuario lo pide o lo confirma explicitamente.

## Rol del agente de review

El agente de review es el punto de control de consistencia:

- Debe comprobar si el codigo reincide en errores ya corregidos.
- Debe usar `get_relevant_changes` y `search_changes` cuando el contexto lo requiera.
- Debe indicar al agente implementador que ajustes concretos hay que hacer cuando encuentre discrepancias.
- Puede sugerir que una correccion merece guardarse, pero no debe registrar nada con `add_change` ni `add_change_global` sin peticion o confirmacion explicita del usuario.

## Regla de prioridad

Si un cambio recuperado entra en conflicto con la tarea actual, el agente debe:

- dar prioridad a la instruccion explicita mas reciente del usuario,
- explicar el conflicto de forma breve,
- y solo guardar un nuevo cambio si el criterio corregido pasa a ser reutilizable.
