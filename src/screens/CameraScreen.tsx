import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

let CameraView: any = null;
let useCameraPermissions: any = null;
let ImageManipulator: any = null;

if (Platform.OS !== 'web') {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
  ImageManipulator = require('expo-image-manipulator');
}

import { getColorInfo, ColorInfo } from '../utils/colorNames';
import { extractPixelFromPng, extractAllPixelsFromPng } from '../utils/pngPixel';
import { COLORS, FONTS } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SCAN_INTERVAL_MS = 1500;
const CROSSHAIR_SIZE = 140;
const GRID_SIZE = 16;
const WHITE_REF_BOX = 90;
const CORNER_LEN = 18;
const CORNER_THICK = 3;

interface WhiteRef {
  r: number;
  g: number;
  b: number;
  gridX: number;
  gridY: number;
}

function findWhiteRegion(pixels: [number, number, number][][]): WhiteRef | null {
  if (!pixels.length || !pixels[0].length) return null;
  let bestScore = -Infinity;
  let best: WhiteRef | null = null;

  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const [r, g, b] = pixels[y][x];
      const brightness = (r + g + b) / 3;
      const colorCast = Math.max(r, g, b) - Math.min(r, g, b);
      const score = brightness - colorCast * 2;
      if (score > bestScore) {
        bestScore = score;
        best = { r, g, b, gridX: x, gridY: y };
      }
    }
  }

  return bestScore >= 150 ? best : null;
}

function WebFallback() {
  return (
    <View style={styles.centered}>
      <Text style={styles.permTitle}>📱 Open in Expo Go</Text>
      <Text style={styles.permText}>
        Colour Detective needs a real camera to work.{'\n\n'}
        Open Expo Go on your phone and paste this URL:
      </Text>
      <View style={{ backgroundColor: 'rgba(123,97,255,0.15)', borderRadius: 12, padding: 16, marginTop: 8 }}>
        <Text style={{ color: '#7B61FF', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}>
          exp://u.expo.dev/aa06313f-dc9d-4ec9-a724-c885adf4f1e3{'\n'}?channel-name=preview
        </Text>
      </View>
    </View>
  );
}

export default function CameraScreen() {
  if (Platform.OS === 'web') {
    return <WebFallback />;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return <NativeCameraScreen />;
}

function NativeCameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [colorInfo, setColorInfo] = useState<ColorInfo>({
    name: 'Detecting…',
    hex: '#808080',
    emoji: '🔍',
  });
  const [isScanning, setIsScanning] = useState(false);
  const [complexMode, setComplexMode] = useState(false);
  const [whiteRefEnabled, setWhiteRefEnabled] = useState(false);
  const [whiteRefPos, setWhiteRefPos] = useState<WhiteRef | null>(null);

  const cameraRef = useRef<any>(null);
  const scanningRef = useRef(false);
  const whiteRefDataRef = useRef<WhiteRef | null>(null);

  const breathScale = useRef(new Animated.Value(1)).current;
  const scanOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, { toValue: 1.12, duration: 1000, useNativeDriver: true }),
        Animated.timing(breathScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [breathScale]);

  useEffect(() => {
    if (isScanning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scanOpacity, { toValue: 0.4, duration: 300, useNativeDriver: true }),
          Animated.timing(scanOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      scanOpacity.setValue(1);
    }
  }, [isScanning, scanOpacity]);

  const scanColor = useCallback(async () => {
    if (scanningRef.current || !cameraRef.current) return;
    scanningRef.current = true;
    setIsScanning(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
        skipProcessing: true,
      });

      if (!photo) return;

      // Center crop → 1×1 for colour reading
      const imgW = photo.width;
      const imgH = photo.height;
      const cropW = Math.floor(imgW * 0.15);
      const cropH = Math.floor(imgH * 0.15);
      const originX = Math.floor((imgW - cropW) / 2);
      const originY = Math.floor((imgH - cropH) / 2);

      const centerResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          { crop: { originX, originY, width: cropW, height: cropH } },
          { resize: { width: 1, height: 1 } },
        ],
        { format: ImageManipulator.SaveFormat.PNG, base64: true }
      );

      if (centerResult.base64) {
        let [r, g, b] = extractPixelFromPng(centerResult.base64);

        // Apply white balance correction if reference is set
        if (whiteRefEnabled) {
          const ref = whiteRefDataRef.current;
          if (ref && ref.r > 20 && ref.g > 20 && ref.b > 20) {
            r = Math.min(255, Math.round((r * 255) / ref.r));
            g = Math.min(255, Math.round((g * 255) / ref.g));
            b = Math.min(255, Math.round((b * 255) / ref.b));
          }
        }

        const info = getColorInfo(r, g, b, complexMode);
        setColorInfo(info);
      }

      // White region detection — resize full photo to 16×16 grid
      if (whiteRefEnabled) {
        const gridResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: GRID_SIZE, height: GRID_SIZE } }],
          { format: ImageManipulator.SaveFormat.PNG, base64: true }
        );
        if (gridResult.base64) {
          const pixels = extractAllPixelsFromPng(gridResult.base64, GRID_SIZE, GRID_SIZE);
          const region = findWhiteRegion(pixels);
          whiteRefDataRef.current = region;
          setWhiteRefPos(region);
        }
      }
    } catch {
      // Silently continue
    } finally {
      scanningRef.current = false;
      setIsScanning(false);
    }
  }, [complexMode, whiteRefEnabled]);

  useEffect(() => {
    const interval = setInterval(scanColor, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scanColor]);

  const handleToggleWhiteRef = () => {
    const next = !whiteRefEnabled;
    setWhiteRefEnabled(next);
    if (!next) {
      setWhiteRefPos(null);
      whiteRefDataRef.current = null;
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>📷 Camera Access Needed</Text>
        <Text style={styles.permText}>We need the camera to detect colours around you!</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // White ref framing box screen position
  const whiteBoxLeft = whiteRefPos
    ? Math.max(4, Math.min(SCREEN_WIDTH - WHITE_REF_BOX - 4,
        ((whiteRefPos.gridX + 0.5) / GRID_SIZE) * SCREEN_WIDTH - WHITE_REF_BOX / 2))
    : 0;
  const whiteBoxTop = whiteRefPos
    ? Math.max(4, Math.min(SCREEN_HEIGHT - WHITE_REF_BOX - 24,
        ((whiteRefPos.gridY + 0.5) / GRID_SIZE) * SCREEN_HEIGHT - WHITE_REF_BOX / 2))
    : 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen camera */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* White reference framing box */}
      {whiteRefEnabled && whiteRefPos && (
        <View
          style={[styles.whiteRefFrame, { left: whiteBoxLeft, top: whiteBoxTop }]}
          pointerEvents="none"
        >
          {/* Corner brackets */}
          <View style={[styles.corner, { top: 0, left: 0, width: CORNER_LEN, height: CORNER_THICK }]} />
          <View style={[styles.corner, { top: 0, left: 0, width: CORNER_THICK, height: CORNER_LEN }]} />
          <View style={[styles.corner, { top: 0, right: 0, width: CORNER_LEN, height: CORNER_THICK }]} />
          <View style={[styles.corner, { top: 0, right: 0, width: CORNER_THICK, height: CORNER_LEN }]} />
          <View style={[styles.corner, { bottom: 0, left: 0, width: CORNER_LEN, height: CORNER_THICK }]} />
          <View style={[styles.corner, { bottom: 0, left: 0, width: CORNER_THICK, height: CORNER_LEN }]} />
          <View style={[styles.corner, { bottom: 0, right: 0, width: CORNER_LEN, height: CORNER_THICK }]} />
          <View style={[styles.corner, { bottom: 0, right: 0, width: CORNER_THICK, height: CORNER_LEN }]} />
          <Text style={styles.whiteRefLabel}>White reference</Text>
        </View>
      )}

      {/* Mode toggle — top right */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.togglePill, !complexMode && styles.toggleActive]}
            onPress={() => setComplexMode(false)}
          >
            <Text style={[FONTS.toggle, styles.toggleText, !complexMode && styles.toggleTextActive]}>
              Simple
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, complexMode && styles.toggleActive]}
            onPress={() => setComplexMode(true)}
          >
            <Text style={[FONTS.toggle, styles.toggleText, complexMode && styles.toggleTextActive]}>
              Complex
            </Text>
          </TouchableOpacity>
          <View style={styles.toggleDivider} />
          <TouchableOpacity
            style={[styles.togglePill, whiteRefEnabled && styles.toggleActiveRef]}
            onPress={handleToggleWhiteRef}
          >
            <Text style={[FONTS.toggle, styles.toggleText, whiteRefEnabled && styles.toggleTextActive]}>
              {whiteRefEnabled && !whiteRefPos ? '⬜ …' : '⬜ Ref'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Center crosshair */}
      <View style={styles.crosshairContainer} pointerEvents="none">
        <Animated.View
          style={[styles.crosshairOuter, { transform: [{ scale: breathScale }], opacity: scanOpacity }]}
        >
          <View style={styles.circle} />
          <View style={styles.crossHorizontal} />
          <View style={styles.crossVertical} />
        </Animated.View>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        <View style={[styles.swatchStrip, { backgroundColor: colorInfo.hex }]} />
        <View style={styles.colorInfoRow}>
          <View style={styles.colorTextBlock}>
            <Text style={[FONTS.colorName, styles.colorNameText]}>
              {colorInfo.emoji} {colorInfo.name}
            </Text>
            {complexMode && (
              <Text style={[FONTS.colorNameSub, styles.hexText]}>{colorInfo.hex}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  permTitle: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  permText: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginBottom: 24 },
  permButton: { backgroundColor: COLORS.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
  permButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    alignItems: 'flex-end', paddingTop: 12, paddingRight: 16,
  },
  toggleContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24, padding: 4, alignItems: 'center',
  },
  togglePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  toggleActive: { backgroundColor: COLORS.accent },
  toggleActiveRef: { backgroundColor: '#d4a017' },
  toggleDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 2 },
  toggleText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  toggleTextActive: { color: COLORS.text },

  // White reference framing box
  whiteRefFrame: {
    position: 'absolute', width: WHITE_REF_BOX, height: WHITE_REF_BOX, zIndex: 5,
  },
  corner: { position: 'absolute', backgroundColor: 'rgba(255,230,80,0.95)' },
  whiteRefLabel: {
    position: 'absolute', bottom: -20, left: 0, right: 0,
    textAlign: 'center', color: 'rgba(255,230,80,1)',
    fontSize: 10, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  crosshairContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  crosshairOuter: { width: CROSSHAIR_SIZE, height: CROSSHAIR_SIZE, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute', width: CROSSHAIR_SIZE, height: CROSSHAIR_SIZE,
    borderRadius: CROSSHAIR_SIZE / 2, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'transparent',
  },
  crossHorizontal: { position: 'absolute', width: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 1 },
  crossVertical: { position: 'absolute', width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 1 },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13, 14, 26, 0.88)', paddingBottom: 40,
  },
  swatchStrip: { height: 8, width: '100%' },
  colorInfoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  colorTextBlock: { flex: 1 },
  colorNameText: { color: COLORS.text, fontSize: 52, fontWeight: '800', letterSpacing: -1 },
  hexText: { color: COLORS.textMuted, fontSize: 22, fontWeight: '600', marginTop: 2 },
});
