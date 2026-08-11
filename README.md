# Changes Memory MCP

MCP local para capturar correcciones y criterios que quieres reutilizar entre conversaciones, usando `.codex/changes.md` como fuente de verdad legible por humanos.

## Que resuelve

- Guarda cambios pedidos por el usuario en un formato estable.
- Permite listar, buscar y recuperar cambios relevantes para una tarea nueva.
- Evita repetir errores si los agentes consultan este MCP antes de implementar o revisar.

## Archivo de memoria

El fichero persistente es:

- `.codex/changes.md` dentro de este repositorio por defecto.

Puedes cambiarlo con variables de entorno:

- `CHANGES_MEMORY_ROOT`: directorio raiz donde se usara `.codex/changes.md`.
- `CHANGES_MEMORY_PATH`: ruta exacta del fichero de memoria.

## Herramientas MCP

- `add_change`: guarda un nuevo cambio/correccion.
- `list_changes`: lista entradas existentes.
- `search_changes`: busca por texto libre, tags o rutas.
- `get_relevant_changes`: devuelve las entradas mas relevantes para una tarea concreta.
- `get_change`: recupera una entrada exacta por id.

## Ejecucion

```sh
node /ruta/a/knowledge-memory/src/index.js
```

## Configuracion MCP en Codex

Ejemplo de bloque para tu `~/.codex/config.toml`:

```toml
[mcp_servers.changes_memory]
command = "node"
args = ["/ruta/a/knowledge-memory/src/index.js"]
```

Despues de guardar la configuracion, reinicia Codex para asegurar la recarga del MCP.

## Instruccion recomendada para agentes

Si quieres forzar el uso, anade una regla en tus instrucciones globales o por repo similar a esta:

```md
Antes de implementar o revisar cambios, consulta `get_relevant_changes` en el MCP `changes_memory` con un resumen de la tarea y aplica los criterios recuperados si siguen siendo pertinentes.
```

## Notas

- La persistencia actual usa solo `changes.md`, sin base de datos ni indice externo.
- La busqueda es textual con ranking simple; suficiente para empezar y facil de auditar.
- Si luego quieres, se puede evolucionar a scopes `repo/global`, confirmacion editable y salida tipo `Antes -> Ahora`.
