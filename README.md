# Changes Memory MCP

MCP local para capturar correcciones y criterios que quieres reutilizar entre conversaciones, con una sola configuracion de Codex y stores separados por proyecto + global.

## Que resuelve

- Guarda cambios pedidos por el usuario en un formato estable.
- Permite listar, buscar y recuperar cambios relevantes para una tarea nueva.
- Evita repetir errores si los agentes consultan este MCP antes de implementar o revisar.

## Stores de memoria

Por defecto guarda en:

```text
~/.codex/changes-memory/
  global/changes.md
  projects/
    <project-key>/changes.md
```

Puedes cambiarlo con argumentos o variables de entorno:

- `--store-root=/ruta/al/store`: directorio raiz del store global + proyectos.
- `--project-path=/ruta/al/proyecto`: proyecto por defecto si una tool no recibe `projectPath`.
- `CHANGES_MEMORY_STORE_ROOT`: equivalente a `--store-root`.
- `CHANGES_MEMORY_PROJECT_PATH`: equivalente a `--project-path`.

Compatibilidad anterior:

- `--memory-root` y `CHANGES_MEMORY_ROOT` siguen funcionando como proyecto por defecto.
- `--memory-path` y `CHANGES_MEMORY_PATH` fuerzan un fichero exacto para la memoria del proyecto por defecto.

## Herramientas MCP

- `add_change`: guarda un nuevo cambio/correccion en la memoria del proyecto.
- `add_change_global`: guarda un criterio transversal en la memoria global.
- `list_changes`: lista entradas del proyecto y global por defecto.
- `search_changes`: busca por texto libre, tags o rutas.
- `get_relevant_changes`: devuelve las entradas mas relevantes de proyecto + global para una tarea concreta.
- `get_change`: recupera una entrada exacta por id buscando en proyecto + global.

Las tools de consulta y `add_change` aceptan `projectPath`, `projectKey` o `project` para seleccionar proyecto cuando una conversacion trabaja con varios repos.

## Ejecucion desde GitHub

```sh
npx -y --package github:formonkey/knowledge-memory-mcp#main changes-memory-mcp --store-root=/ruta/al/store
```

## Ejecucion desde checkout local

```sh
node /ruta/a/knowledge-memory-mcp/src/index.js --store-root=/ruta/al/store
```

## Configuracion MCP en Codex

Una sola config global en `~/.codex/config.toml`.

Recomendado, directamente desde GitHub:

```toml
[mcp_servers.changes_memory]
command = "npx"
args = [
  "-y",
  "--package",
  "github:formonkey/knowledge-memory-mcp#main",
  "changes-memory-mcp",
  "--store-root=/Users/nigma/.codex/changes-memory"
]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "auto"
```

Checkout local:

```toml
[mcp_servers.changes_memory]
command = "node"
args = [
  "/absolute/path/to/knowledge-memory-mcp/src/index.js",
  "--store-root=/Users/nigma/.codex/changes-memory"
]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "auto"
```

Alternativa con variables de entorno:

```toml
[mcp_servers.changes_memory.env]
CHANGES_MEMORY_STORE_ROOT = "/Users/nigma/.codex/changes-memory"
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
