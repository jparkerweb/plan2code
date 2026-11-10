# Caller Search
> Part of plan2code-dead-code: read in Step 4 before the caller search, and given to every helper that searches. Never invoked as a skill.

A candidate is dead only when nothing in the whole project reaches it. Search the whole project, never only the folder the run covers, and search for more than the plain name: the lists below are what else can reach an item in each language group. Include tests, scripts, config files, docs that act as config (an OpenAPI file, a route table, a cron file) and generated glue (bindings, stubs, registration files).

## Every language

- The plain name, as a whole word, in every text file, not only in source files of the same language.
- The name inside strings and templates: config keys, JSON and YAML values, SQL, HTML attributes, environment files.
- Build files, CI configs, `Dockerfile`, `Makefile`, package scripts and shell scripts that call a file or a function by name.
- A file candidate: its path and its file name without the extension, anywhere.
- Record what each search found in `callers`, even when it found nothing ("no match outside its own file").

## JavaScript and TypeScript

- Re-exports: `export * from`, `export { x } from`, and the barrel files (`index.js`, `index.ts`) that pass a name on.
- Dynamic `import()` with a string or template path, and `require()` with a computed path.
- `package.json` `exports`, `main`, `module`, `bin` and `types`; a workspace's other packages that import this one.
- Framework conventions that load by file name: route folders (`pages/`, `app/`, `routes/`), `*.config.*` files, test setup files.
- Names reached by string: `obj[name]`, event names, `customElements.define`, decorators.

## Python

- `__all__` lists, and `from module import *` that brings them in.
- `getattr`, `importlib.import_module`, `__import__` and string paths such as `"package.module:func"`.
- Decorators that register a function (routes, CLI commands, signal handlers, pytest fixtures used by name).
- Entry points in `pyproject.toml`, `setup.cfg` and `setup.py` (`console_scripts`, plugin groups), and `manage.py` or framework settings that name a module.

## Rust

- `pub use` re-exports and the crate's public API in `lib.rs`.
- Macros that expand to a call (`macro_rules!` bodies, derive and attribute macros).
- `#[cfg(...)]` and feature flags: an item used only under a feature or a target is still used.
- `mod` declarations, `#[path]` attributes, `build.rs`, and binaries under `src/bin/` or `[[bin]]` in `Cargo.toml`.

## Go

- Exported names (capitalized) used from another package or module in the workspace.
- Interface satisfaction: a method with no direct caller may make a type meet an interface used elsewhere.
- `init()` functions, blank imports (`import _ "pkg"`) that run them, and `//go:generate` lines.
- Build tags and file-name suffixes (`_linux.go`, `_test.go`), and reflection (`reflect`, `MethodByName`, struct tags read at runtime).

## Java and Kotlin

- Reflection: `Class.forName`, `getMethod`, `getDeclaredField`, and names in strings.
- Annotations that register or call: `@Bean`, `@Component`, `@Controller`, `@RequestMapping`, `@Test`, `@JsonCreator`, `@Subscribe`, `main` methods.
- Spring and other dependency injection: XML configs, `application.properties` and `application.yml`, component scanning by package.
- `META-INF/services` files, `AndroidManifest.xml`, Gradle and Maven files that name a class, and Kotlin `@JvmStatic` or `companion object` members called from Java.

## C#

- Reflection: `Type.GetType`, `GetMethod`, `Activator.CreateInstance`, `nameof` used as a key.
- Attributes that register or call: `[HttpGet]`, `[Route]`, `[Fact]`, `[Test]`, `[JsonConstructor]`, `[DllImport]`.
- Dependency injection registration (`AddScoped`, `AddTransient`, `AddSingleton`, assembly scanning) and `appsettings.json`.
- Serialization: properties set only by a serializer, and `.csproj`, `.xaml` and `.razor` files that name a type or handler.

## Ruby

- `send`, `public_send`, `method`, `define_method` and `respond_to?` with a symbol or string.
- `constantize`, `const_get` and class names built from strings.
- Rails autoloading and conventions: controllers and actions reached through `config/routes.rb`, callbacks (`before_action`, `after_save`), helpers, jobs, mailers, views that call a helper, and concerns.
- Rake tasks, `Gemfile` and gemspec `executables`, and initializers.

## PHP

- Composer autoload (`psr-4`, `classmap`, `files`) and `bin` entries in `composer.json`.
- `class_exists`, `method_exists`, `call_user_func`, variable functions (`$fn()`) and `new $class`.
- Routes and container config: framework route files, service container definitions (YAML, XML, PHP arrays), event listeners and middleware lists.
- Templates (Blade, Twig) that call a function or helper by name, and attributes such as `#[Route]`.

## Any other language

Search the plain name, strings and config as in "Every language", say which of the language's dynamic features you could not cover, and leave the finding at Check first.
