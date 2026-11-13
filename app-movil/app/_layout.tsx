import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MarcoEscritorio } from '@/componentes/MarcoEscritorio';
import { cargarFuentes } from '@/tema/fuentes';
import { usarFavoritos } from '@/estado/favoritos';
import { usarSesion } from '@/estado/sesion';
import { color } from '@/tema/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Raiz() {
  const [listo, setListo] = useState(false);
  const iniciarSesion = usarSesion((s) => s.iniciar);
  const cargarFavoritos = usarFavoritos((s) => s.cargar);

  useEffect(() => {
    (async () => {
      await Promise.all([cargarFuentes(), iniciarSesion(), cargarFavoritos()]);
      setListo(true);
      await SplashScreen.hideAsync().catch(() => {});
    })();
  }, [iniciarSesion, cargarFavoritos]);

  if (!listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <MarcoEscritorio>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.marfil },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entrar" options={{ animation: 'fade' }} />
          <Stack.Screen name="producto/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="carrito" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="pedido/[numero]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="mesa/[codigo]" />
          <Stack.Screen name="direcciones" />
          <Stack.Screen name="pagos" />
          <Stack.Screen name="notificaciones" />
          <Stack.Screen name="favoritos" />
          <Stack.Screen name="historial" />
        </Stack>
        </MarcoEscritorio>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
