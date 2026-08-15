import { Alert, Platform } from 'react-native';

/**
 * Alert.alert de React Native no muestra nada en la versión web: es una
 * limitación conocida de react-native-web. La función se llama, no lanza
 * ningún error, pero ningún diálogo aparece en pantalla. Cualquier código
 * que dependiera de Alert.alert para avisar un fallo (por ejemplo, un
 * pedido que no se pudo crear porque no había sesión) fallaba en silencio
 * para quien usa la app desde el navegador, aunque funcionara bien en
 * iOS y Android.
 *
 * Este helper cae a `window.alert` en la versión web y usa el Alert
 * nativo en el resto de plataformas. Úsalo en vez de Alert.alert en
 * cualquier pantalla que la app web también sirva.
 */
export function alertar(titulo: string, mensaje?: string) {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
    return;
  }
  Alert.alert(titulo, mensaje);
}
