# Puesta en marcha de CIFEAPORC

Se hace una sola vez. Unos 15 minutos.

## 1. Base de datos (Supabase)

1. Entra en tu proyecto de Supabase → **SQL Editor** → **New query**.
2. Abre `sql/01_esquema.sql`, copia **todo** su contenido, pégalo y pulsa **Run**. Debe terminar con "Success. No rows returned".
3. Ve a **Authentication → Sign In / Providers → Email** (puede aparecer como "Authentication → Providers → Email"):
   - **Confirm email**: desactivado. Las cuentas de alumno usan un correo ficticio y no pueden confirmarlo.
   - Comprueba también que **Allow new users to sign up** está activado (Authentication → Sign In / Providers). Es lo que usa la app cuando creas un alias.
4. Crea tu cuenta de profesor: **Authentication → Users → Add user → Create new user**, con tu correo y una contraseña de al menos 8 caracteres, y marca **Auto Confirm User**.
5. Vuelve al **SQL Editor**, abre `sql/02_profesor.sql`, cambia el correo por el tuyo y el alias si quieres, y pulsa **Run**. Debe decir "Success… 1 row".

## 2. Publicación (GitHub Pages)

1. En GitHub, repositorio **cifeaporc** → **Settings → Pages**.
2. En **Build and deployment → Source**, elige **Deploy from a branch**; rama **main**, carpeta **/ (root)**; **Save**.
3. A los uno o dos minutos la app está en `https://cifeaporc1.github.io/cifeaporc/`.

## 3. Primeros pasos en la app

1. Entra como **Profesor** con tu correo y contraseña.
2. **Gestión → Censo**: da de alta los verracos y las cerdas.
3. **Gestión → Alumnos**: crea un alias de prueba (por ejemplo `PRUEBA`) en la granja de 1.º, sal y entra como alumno con ese alias y su PIN.
4. Registra un evento con el alumno de prueba y comprueba que lo ves como profesor en esa granja y no en la otra (**Gestión → Granja**).

## Si algo falla

- **"La cuenta no está confirmada"**: falta desactivar *Confirm email* (paso 1.3).
- **"Demasiados intentos seguidos"** al crear muchos alias: Supabase limita las altas seguidas. Espera unos minutos y continúa.
- **"Tu cuenta no tiene acceso"** al entrar como profesor: falta el paso 1.5, o el correo no coincide.
- **La base de datos se ha pausado**: la tarea *Mantener activa la base de datos* (pestaña **Actions** de GitHub) lo evita. Si aun así ocurre, en Supabase pulsa **Restore project**.
