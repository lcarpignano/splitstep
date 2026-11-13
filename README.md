# SplitStep · Reacción para tenis

Web app instalable (PWA) de entrenamiento de reacción orientada a tenis, para uso personal en el iPhone.
Sin dependencias ni build: HTML + CSS + JavaScript (módulos ES).

## Qué hace

- **Estímulos aleatorios**: colores a pantalla completa, flechas (8 direcciones), números, palabras Stroop, beeps y voz en español.
- **10 drills de tenis**: split step + dirección, peloteo acelerado, drive o revés, go / no-go, cubrir la cancha (6 zonas), cuatro direcciones, reflejos en la red, devolución de saque (flash), Stroop y test de tiempo de reacción.
- **Configurable por drill**: repeticiones o tiempo, series, descanso, intervalo aleatorio mín/máx, duración visible (flash), voz, beep, aceleración.
- **Medición de reacción**: por **toque** de pantalla o por **cámara frontal** (detección de inicio de movimiento por diferencia de cuadros, espera a que estés quieto antes de cada estímulo, cuenta errores en no-go y anticipaciones).
- **Historial local** con resumen semanal y exportación a JSON.
- Funciona **sin conexión** (service worker) y mantiene la pantalla encendida (Wake Lock).

## Instalar en el iPhone

1. Abrí la URL publicada en **Safari**.
2. **Compartir → Agregar a inicio**.
3. Abrila desde el ícono (pantalla completa, offline). La primera vez que uses la cámara, iOS pide permiso.

## Desarrollo local

```bash
python3 -m http.server 5287 --directory .
```

Abrí http://localhost:5287. La cámara solo funciona en `localhost` o HTTPS.

Íconos: `python3 tools/make_icons.py icons` (sin dependencias).

## Notas

- El tiempo medido por cámara incluye la latencia de la cámara (~50–100 ms): sirve para compararte contra vos mismo, no contra otros sistemas.
- Al cambiar archivos, subí la versión de `CACHE` en `sw.js` si agregás o renombrás archivos.
