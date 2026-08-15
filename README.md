<div align="center">


# La Mesa


**Sistema completo de pedidos para un restaurante: app móvil, panel de cocina y backend.**


*Donde todo se comparte*


[![Verificar](https://github.com/danielbuitragoh/la-mesa/actions/workflows/verificar.yml/badge.svg)](https://github.com/danielbuitragoh/la-mesa/actions/workflows/verificar.yml)


https://github.com/user-attachments/assets/d4c05a5d-8539-47e2-9d4d-f704e5015a48


![La Mesa · app móvil](docs/capturas/portada-app.png)


[**Ver la app**](https://danielbuitragoh.github.io/la-mesa/app-web/) · [**Ver el panel de cocina**](https://danielbuitragoh.github.io/la-mesa/panel/panel-admin.html) · [Ver el prototipo](https://danielbuitragoh.github.io/la-mesa/prototipo/la-mesa-app.html) · [Cómo se construyó](docs/BRIEF.md)


🎨 **Dirección creativa:** [Gabriela Chávez](https://www.instagram.com/gabrielae.cc)


</div>


---


## Qué es


Un proyecto personal donde diseñé y construí el sistema completo que necesitaría un restaurante para vender por su cuenta, sin ceder el 30% de comisión a una plataforma de delivery: la app del cliente, el tablero que usa la cocina y el backend que los conecta.


La marca —identidad visual, tono, nombre— es ficticia y la creé para el proyecto. El punto no es el restaurante: es mostrar cómo llevo algo desde una imagen de design system hasta un sistema que compila, se verifica solo y se puede desplegar.


**Los enlaces de arriba funcionan.** No son videos ni mockups: la app y el panel corren en el navegador contra el backend real, con datos de demostración. El prototipo es un recorrido visual sin backend, para navegarlo más rápido. Se pueden tocar.


## Lo que más me interesa que se mire


**Mesa Compartida.** El lema de la marca es "donde todo se comparte", así que lo convertí en función en vez de dejarlo en el eslogan: abres una mesa, compartes un código de seis dígitos, y cada quien agrega sus platos al mismo pedido desde su teléfono. Los cambios de los demás aparecen en tu pantalla en vivo. Al cerrar, cada uno paga lo suyo o alguien invita. Ninguna app grande de la categoría en Colombia lo tiene resuelto.


**La mesa que gira.** El menú no arranca como una lista sino como una mesa vista desde arriba, con las categorías servidas alrededor. Se gira con el dedo —y encaja sola en el plato más cercano al soltar, con su punto de inercia— o se toca un plato y la mesa gira hasta traerlo al frente antes de abrir esa categoría. La navegación y la metáfora de la marca son el mismo gesto, no dos cosas pegadas.


**El anillo.** El isotipo es un anillo abierto —una mesa vista desde arriba— y lo usé como dispositivo estructural en toda la app: rodea a quienes comparten mesa, se llena a medida que avanza el pedido, marca el progreso hacia el siguiente nivel de fidelidad. Es el único gesto decorativo que me permití; todo lo demás se mantiene sobrio.


**La seguridad del pago.** El monto a cobrar nunca sale del teléfono. La app manda solo el id del pedido y el servidor recalcula el total desde la base antes de firmar. En el otro sentido, la app nunca decide que un pago salió bien: eso lo confirma la pasarela contra un webhook cuyo checksum se valida. Quien tenga el APK puede leer cualquier cosa que esté dentro de la app, así que el secreto de integridad vive en el servidor y nada más. Detalles en [`supabase/functions/README.md`](supabase/functions/README.md).


**Que no se rompa sin que nadie se entere.** Cada push corre cinco verificaciones distintas, incluidas dos que escribí para este proyecto: una mide el contraste de los catorce pares de color de la paleta contra WCAG AA, y otra comprueba que cada tabla, columna y estado que el código le pide a la base exista de verdad en el esquema.


## Cómo está armado


| Pieza | Qué es | Stack |
|---|---|---|
| [`app-movil/`](app-movil/) | App del cliente, iOS y Android · 16 pantallas | Expo · React Native · TypeScript · Zustand |
| [`panel/`](panel/) | Tablero de cocina y gestión de menú | HTML, CSS y JS sin dependencias |
